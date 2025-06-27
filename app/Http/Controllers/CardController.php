<?php
// app/Http/Controllers/CardController.php
namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Card;
use App\Models\LList; // Using LList for the model
use App\Models\Board;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;

class CardController extends Controller
{
    /**
     * Display a listing of the cards for a given list.
     * GET /api/lists/{list}/cards
     */
    public function index(Request $request, LList $list)
    {
        $tenantId = $request->header('X-Tenant-ID');
        if ($list->tenant_id != $tenantId) {
            abort(403, 'Unauthorized access: List does not belong to the current tenant.');
        }

        try {
            $cards = $list->cards()->orderBy('order')->get();
            return response()->json($cards);
        } catch (\Throwable $e) {
            Log::error('Error fetching cards in index', [
                'list_id' => $list->id,
                'tenant_id' => $tenantId,
                'error_message' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            return response()->json(['error' => 'Failed to fetch cards.'], 500);
        }
    }

    /**
     * Store a newly created card in storage.
     * POST /api/lists/{list}/cards
     */
    public function store(Request $request, LList $list)
    {
        $tenantId = $request->header('X-Tenant-ID');

        if ($list->tenant_id != $tenantId) {
            abort(403, 'Unauthorized to create card on this list: List tenant mismatch.');
        }

        Log::info('CardController@store: Attempting to create card.', [
            'list_id' => $list->id,
            'tenant_id_request' => $tenantId,
            'request_data' => $request->all(),
        ]);

        try {
            $validated = $request->validate([
                'title' => 'required|string|max:255',
                'description' => 'nullable|string|max:1000',
                'due_date' => 'nullable|date',
                'status' => 'required|string|in:todo,in_progress,done',
                'order' => 'integer|min:0',
                'user_id' => 'nullable|exists:users,id',
            ]);

            $maxOrder = Card::where('list_id', $list->id)
                            ->where('tenant_id', $tenantId)
                            ->max('order');
            $order = $validated['order'] ?? ($maxOrder !== null ? $maxOrder + 1 : 0);

            $card = Card::create([
                'title' => $validated['title'],
                'description' => $validated['description'] ?? null,
                'due_date' => $validated['due_date'] ?? null,
                'status' => $validated['status'],
                'order' => $order,
                'list_id' => $list->id,
                'board_id' => $list->board_id,
                'tenant_id' => $tenantId,
                'user_id' => $validated['user_id'] ?? $request->user()->id,
            ]);

            Log::info('Card created successfully.', ['card_id' => $card->id, 'list_id' => $list->id, 'tenant_id' => $card->tenant_id]);

            return response()->json($card, 201);
        } catch (ValidationException $e) {
            Log::error('Validation failed during card store', ['errors' => $e->errors(), 'request_data' => $request->all()]);
            return response()->json(['error' => 'Validation failed.', 'details' => $e->errors()], 422);
        } catch (\Throwable $e) {
            Log::error('Unexpected error during card store', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return response()->json(['error' => 'An unexpected error occurred.', 'details' => $e->getMessage()], 500);
        }
    }

    /**
     * Display the specified card.
     * GET /api/cards/{card}
     */
    public function show(Request $request, Card $card)
    {
        $tenantId = $request->header('X-Tenant-ID');
        if ($card->tenant_id != $tenantId) {
            abort(403, 'Unauthorized access: Card does not belong to the current tenant.');
        }
        return response()->json($card);
    }

    /**
     * Update the specified card in storage.
     * PUT /api/cards/{card}
     */
    public function update(Request $request, Card $card)
    {
        $tenantId = $request->header('X-Tenant-ID');

        if ($card->tenant_id != $tenantId) {
            abort(403, 'Unauthorized to update this card: Card tenant mismatch.');
        }

        Log::info('CardController@update: Attempting to update card.', [
            'card_id' => $card->id,
            'tenant_id_request' => $tenantId,
            'request_data' => $request->all(),
        ]);

        try {
            $validated = $request->validate([
                'title' => 'sometimes|required|string|max:255',
                'description' => 'nullable|string|max:1000',
                'due_date' => 'nullable|date',
                'status' => 'sometimes|required|string|in:todo,in_progress,done',
                'order' => 'sometimes|required|integer|min:0',
                'list_id' => [
                    'sometimes',
                    'required',
                    'exists:lists,id',
                    Rule::exists('lists', 'id')->where(function ($query) use ($tenantId) {
                        return $query->where('tenant_id', $tenantId);
                    }),
                ],
                'user_id' => 'nullable|exists:users,id',
            ]);

            if (isset($validated['list_id']) && $validated['list_id'] !== $card->list_id) {
                $newList = LList::find($validated['list_id']);
                if ($newList && $newList->board_id !== $card->board_id) {
                    $validated['board_id'] = $newList->board_id;
                }
            }

            $card->update($validated);

            Log::info('Card updated successfully.', ['card_id' => $card->id, 'list_id' => $card->list_id, 'tenant_id' => $card->tenant_id]);

            return response()->json($card);
        } catch (ValidationException $e) {
            Log::error('Validation failed during card update', ['card_id' => $card->id, 'errors' => $e->errors(), 'request_data' => $request->all()]);
            return response()->json(['error' => 'Validation failed.', 'details' => $e->errors()], 422);
        } catch (\Throwable $e) {
            Log::error('Unexpected error during card update', ['card_id' => $card->id, 'error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return response()->json(['error' => 'An unexpected error occurred.', 'details' => $e->getMessage()], 500);
        }
    }

    /**
     * Remove the specified card from storage.
     * DELETE /api/cards/{card}
     */
    public function destroy(Request $request, Card $card)
    {
        $tenantId = $request->header('X-Tenant-ID');
        if ($card->tenant_id != $tenantId) {
            abort(403, 'Unauthorized to delete this card: Card tenant mismatch.');
        }

        try {
            $card->delete();
            Log::info('Card deleted successfully.', ['card_id' => $card->id, 'list_id' => $card->list_id, 'tenant_id' => $card->tenant_id]);

            return response()->noContent();
        } catch (\Throwable $e) {
            Log::error('Error deleting card', ['card_id' => $card->id, 'error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return response()->json(['error' => 'Failed to delete card.'], 500);
        }
    }

    /**
     * Reorder cards within a specific list.
     * PUT /api/lists/{list}/cards/reorder
     */
    public function reorderCardsInList(Request $request, LList $list)
    {
        $tenantId = $request->header('X-Tenant-ID');

        if ($list->tenant_id != $tenantId) {
            abort(403, 'Unauthorized to reorder cards in this list: List tenant mismatch.');
        }

        Log::info('CardController@reorderCardsInList: Attempting to reorder cards in list.', [
            'list_id' => $list->id,
            'tenant_id_request' => $tenantId,
            'request_data' => $request->all(),
        ]);

        try {
            $validatedData = $request->validate([
                'card_ids' => 'nullable|array', // CAMBIO CLAVE AQUÍ: Permitir array vacío
                'card_ids.*' => [
                    'sometimes', // CAMBIO CLAVE AQUÍ: Solo validar si hay elementos
                    'exists:cards,id',
                    Rule::exists('cards', 'id')->where(function ($query) use ($list, $tenantId) {
                        return $query->where('list_id', $list->id)
                                     ->where('tenant_id', $tenantId);
                    }),
                ],
            ]);

            DB::transaction(function () use ($validatedData, $list, $tenantId) {
                // Solo iterar si card_ids no es nulo y tiene elementos
                if (!empty($validatedData['card_ids'])) {
                    foreach ($validatedData['card_ids'] as $index => $cardId) {
                        Card::where('id', $cardId)
                            ->where('list_id', $list->id)
                            ->where('tenant_id', $tenantId)
                            ->update(['order' => $index]);
                    }
                }
            });

            // Siempre devolver las tarjetas ordenadas, incluso si la lista está vacía
            $orderedCards = Card::where('list_id', $list->id)
                                ->where('tenant_id', $tenantId)
                                ->orderBy('order')
                                ->get();

            Log::info('Cards reordered successfully in list.', ['list_id' => $list->id, 'tenant_id' => $tenantId, 'reordered_count' => count($orderedCards)]);

            return response()->json($orderedCards, 200);
        } catch (ValidationException $e) {
            Log::error('Validation failed during reorderCardsInList', ['errors' => $e->errors(), 'request_data' => $request->all()]);
            return response()->json(['error' => 'Validation failed.', 'details' => $e->errors()], 422);
        } catch (\Throwable $e) {
            Log::error('Unexpected error during reorderCardsInList', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString(), 'request_data' => $request->all()]);
            return response()->json(['error' => 'An unexpected error occurred.', 'details' => $e->getMessage()], 500);
        }
    }
}

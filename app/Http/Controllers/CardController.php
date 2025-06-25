<?php
// app/Http/Controllers/CardController.php
namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Card;
use App\Models\LList; // Using LList for the model
use App\Models\Board;
use Illuminate\Validation\ValidationException;
use Illuminate\Support\Facades\Log;

class CardController extends Controller
{
    /**
     * Display a listing of the cards for a given list.
     * GET /api/lists/{list}/cards
     */
    public function index(Request $request, LList $list)
    {
        // Ensure the list's board belongs to the current tenant and user (security check)
        $board = Board::where('id', $list->board_id)
                      ->where('tenant_id', $request->header('X-Tenant-ID'))
                      ->where('user_id', $request->user()->id)
                      ->first();
        if (!$board) {
            abort(403, 'Unauthorized access to this list\'s cards.');
        }

        try {
            $cards = Card::where('list_id', $list->id)
                ->where('tenant_id', $request->header('X-Tenant-ID'))
                ->orderBy('order')
                ->get();

            return response()->json($cards);
        } catch (\Throwable $e) {
            Log::error('Error fetching cards in index', [
                'list_id' => $list->id,
                'tenant_id' => $request->header('X-Tenant-ID'),
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
        // Ensure the list's board belongs to the current tenant and user (security check)
        $board = Board::where('id', $list->board_id)
                      ->where('tenant_id', $request->header('X-Tenant-ID'))
                      ->where('user_id', $request->user()->id)
                      ->first();
        if (!$board) {
            abort(403, 'Unauthorized to create card on this list.');
        }

        try {
            $validated = $request->validate([
                'title' => 'required|string|max:255',
                'description' => 'nullable|string|max:1000',
                'due_date' => 'nullable|date',
                'status' => 'required|string|in:todo,in_progress,done', // Basic statuses
                'order' => 'integer|min:0', // Optional: frontend can suggest an order
                'user_id' => 'nullable|exists:users,id', // User assigned to the card
            ]);

            // Determine the next order if not provided
            $maxOrder = Card::where('list_id', $list->id)->max('order');
            $order = $validated['order'] ?? ($maxOrder !== null ? $maxOrder + 1 : 0);

            $card = Card::create([
                'title' => $validated['title'],
                'description' => $validated['description'] ?? null,
                'due_date' => $validated['due_date'] ?? null,
                'status' => $validated['status'],
                'order' => $order,
                'list_id' => $list->id,
                'board_id' => $list->board_id, // Inherit board_id from list
                'tenant_id' => $request->header('X-Tenant-ID'), // Inherit tenant from board/list
                'user_id' => $validated['user_id'] ?? null, // Assign the user if provided
            ]);

            Log::info('Card created successfully.', ['card_id' => $card->id, 'list_id' => $list->id, 'tenant_id' => $card->tenant_id]);

            return response()->json($card, 201);
        } catch (ValidationException $e) {
            Log::error('Validation failed during card store', ['errors' => $e->errors()]);
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
        // Ensure the card belongs to the current tenant and its board belongs to the current user
        $board = Board::where('id', $card->board_id)
                      ->where('tenant_id', $request->header('X-Tenant-ID'))
                      ->where('user_id', $request->user()->id)
                      ->first();
        if (!$board) {
            abort(403, 'Unauthorized access to this card.');
        }

        return response()->json($card);
    }

    /**
     * Update the specified card in storage.
     * PUT /api/cards/{card}
     */
    public function update(Request $request, Card $card)
    {
        // Ensure the card belongs to the current tenant and its board belongs to the current user
        $board = Board::where('id', $card->board_id)
                      ->where('tenant_id', $request->header('X-Tenant-ID'))
                      ->where('user_id', $request->user()->id)
                      ->first();
        if (!$board) {
            abort(403, 'Unauthorized to update this card.');
        }

        try {
            $validated = $request->validate([
                'title' => 'required|string|max:255',
                'description' => 'nullable|string|max:1000',
                'due_date' => 'nullable|date',
                'status' => 'required|string|in:todo,in_progress,done',
                'order' => 'integer|min:0',
                'list_id' => [ // Allows moving card to another list
                    'required',
                    'exists:lists,id',
                    Rule::exists('lists', 'id')->where(function ($query) use ($card, $request) {
                        return $query->where('board_id', $card->board_id) // Must be in the same board
                                     ->where('tenant_id', $request->header('X-Tenant-ID'));
                    }),
                ],
                'user_id' => 'nullable|exists:users,id',
            ]);

            $card->update([
                'title' => $validated['title'],
                'description' => $validated['description'] ?? $card->description,
                'due_date' => $validated['due_date'] ?? $card->due_date,
                'status' => $validated['status'],
                'order' => $validated['order'] ?? $card->order,
                'list_id' => $validated['list_id'],
                'user_id' => $validated['user_id'] ?? $card->user_id,
            ]);

            Log::info('Card updated successfully.', ['card_id' => $card->id, 'list_id' => $card->list_id, 'tenant_id' => $card->tenant_id]);

            return response()->json($card);
        } catch (ValidationException $e) {
            Log::error('Validation failed during card update', ['card_id' => $card->id, 'errors' => $e->errors()]);
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
        // Ensure the card belongs to the current tenant and its board belongs to the current user
        $board = Board::where('id', $card->board_id)
                      ->where('tenant_id', $request->header('X-Tenant-ID'))
                      ->where('user_id', $request->user()->id)
                      ->first();
        if (!$board) {
            abort(403, 'Unauthorized to delete this card.');
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
     * Reorder cards within a list or move between lists.
     * POST /api/cards/reorder
     */
    public function reorder(Request $request)
    {
        $tenantId = $request->header('X-Tenant-ID');
        if (!$tenantId) {
            return response()->json(['error' => 'Tenant ID is missing'], 400);
        }

        try {
            $validated = $request->validate([
                'card_id' => 'required|exists:cards,id',
                'new_list_id' => 'required|exists:lists,id',
                'new_order' => 'required|integer|min:0',
            ]);

            $card = Card::where('id', $validated['card_id'])
                        ->where('tenant_id', $tenantId)
                        ->firstOrFail();

            $oldListId = $card->list_id;
            $newListId = $validated['new_list_id'];
            $newOrder = $validated['new_order'];

            // Ensure the target list belongs to the same board as the original card's board,
            // and that board belongs to the current user and tenant.
            $board = Board::where('id', $card->board_id)
                          ->where('tenant_id', $tenantId)
                          ->where('user_id', $request->user()->id)
                          ->first();
            if (!$board) {
                abort(403, 'Unauthorized to reorder cards on this board.');
            }

            // Begin transaction for reordering
            \DB::beginTransaction();

            // Adjust order in the old list
            if ($oldListId === $newListId) {
                // Reordering within the same list
                $cardsToShift = Card::where('list_id', $oldListId)
                    ->where('tenant_id', $tenantId)
                    ->where('id', '!=', $card->id)
                    ->orderBy('order')
                    ->get();

                $newOrderCounter = 0;
                foreach ($cardsToShift as $c) {
                    if ($newOrderCounter === $newOrder) {
                        $newOrderCounter++; // Skip the new position for the moved card
                    }
                    if ($c->order !== $newOrderCounter) {
                        $c->update(['order' => $newOrderCounter]);
                    }
                    $newOrderCounter++;
                }
                $card->update(['order' => $newOrder]);
            } else {
                // Moving between different lists
                // Adjust order in the old list (shift remaining cards up)
                Card::where('list_id', $oldListId)
                    ->where('tenant_id', $tenantId)
                    ->where('order', '>', $card->order)
                    ->decrement('order');

                // Adjust order in the new list (shift cards down to make space)
                Card::where('list_id', $newListId)
                    ->where('tenant_id', $tenantId)
                    ->where('order', '>=', $newOrder)
                    ->increment('order');

                $card->update([
                    'list_id' => $newListId,
                    'order' => $newOrder,
                    'board_id' => $board->id // Ensure board_id is correct after list change
                ]);
            }

            \DB::commit();

            Log::info('Card reordered successfully.', [
                'card_id' => $card->id,
                'old_list_id' => $oldListId,
                'new_list_id' => $newListId,
                'new_order' => $newOrder,
                'tenant_id' => $tenantId,
            ]);

            return response()->json(['message' => 'Card reordered successfully.']);
        } catch (ValidationException $e) {
            \DB::rollBack();
            Log::error('Validation failed during card reorder', ['errors' => $e->errors()]);
            return response()->json(['error' => 'Validation failed.', 'details' => $e->errors()], 422);
        } catch (\Throwable $e) {
            \DB::rollBack();
            Log::error('Unexpected error during card reorder', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return response()->json(['error' => 'An unexpected error occurred.', 'details' => $e->getMessage()], 500);
        }
    }
}

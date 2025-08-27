<?php
// app/Http/Controllers/CardController.php
namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Card;
use App\Models\LList;
use App\Models\Board;
use App\Models\User;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class CardController extends Controller
{
    public function index(Request $request, LList $list)
    {
        $tenantId = $request->header('X-Tenant-ID');
        if ($list->tenant_id != $tenantId) {
            abort(403, 'Unauthorized access: List does not belong to the current tenant.');
        }

        try {
            $cards = $list->cards()->with('members')->orderBy('order')->get();
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

    public function store(Request $request, LList $list)
    {
        $tenantId = $request->header('X-Tenant-ID');
        $user = $request->user();

        if ($list->tenant_id != $tenantId) {
            abort(403, 'Unauthorized to create card on this list: List tenant mismatch.');
        }

        $board = Board::find($list->board_id);
        if (!$user->is_global_admin && (!$board || !$board->members->contains('id', $user->id))) {
            abort(403, 'Unauthorized to create card: You are not a member of the board.');
        }

        Log::info('CardController@store: Attempting to create card.', [
            'list_id' => $list->id,
            'tenant_id_request' => $tenantId,
            'request_data' => $request->all(),
        ]);

        DB::beginTransaction();
        try {
            $validated = $request->validate([
                'title' => 'required|string|max:255',
                'description' => 'nullable|string|max:1000',
                'due_date' => 'nullable|date',
                'status' => 'required|string|in:todo,in_progress,done',
                'order' => 'integer|min:0',
                'user_id' => 'nullable|exists:users,id',
                'checklist' => 'nullable|json',
                'member_ids' => 'nullable|array',
                'member_ids.*' => 'integer|exists:users,id',
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
                'checklist' => $validated['checklist'] ?? null,
            ]);

            if ($request->has('member_ids')) {
                $card->members()->sync($validated['member_ids']);
            }

            if ($board) {
                $board->loadMissing('user');
                $currentBoardMembers = $board->members->pluck('id')->toArray();
                $newCardMembers = $validated['member_ids'];
                $membersToAddToBoard = array_unique(array_merge($currentBoardMembers, $newCardMembers));
                
                if ($board->user && !in_array($board->user->id, $membersToAddToBoard)) {
                    $membersToAddToBoard[] = $board->user->id;
                }

                $board->members()->sync($membersToAddToBoard);
            }

            DB::commit();
            Log::info('Card created successfully.', ['card_id' => $card->id, 'list_id' => $list->id, 'tenant_id' => $card->tenant_id]);
            $card->load('members');
            return response()->json($card, 201);
        } catch (ValidationException $e) {
            DB::rollBack();
            Log::error('Validation failed during card store', ['errors' => $e->errors(), 'request_data' => $request->all()]);
            return response()->json(['error' => 'Validation failed.', 'details' => $e->errors()], 422);
        } catch (\Throwable $e) {
            DB::rollBack();
            Log::error('Unexpected error during card store', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return response()->json(['error' => 'An unexpected error occurred.', 'details' => $e->getMessage()], 500);
        }
    }

    public function show(Request $request, Card $card)
    {
        $tenantId = $request->header('X-Tenant-ID');
        $user = $request->user();

        if (!$user) {
            return response()->json(['error' => 'Unauthenticated.'], 401);
        }

        if ($card->tenant_id != $tenantId) {
            abort(403, 'Unauthorized access: Card does not belong to the current tenant.');
        }

        $board = Board::find($card->board_id);
        if (!$user->is_global_admin && (!$board || !$board->members->contains('id', $user->id))) {
            abort(403, 'Unauthorized access: You are not a member of the board this card belongs to.');
        }

        $card->load('members');
        return response()->json($card);
    }

    public function update(Request $request, Card $card)
    {
        $tenantId = $request->header('X-Tenant-ID');
        $user = $request->user();

        if (!$user) {
            return response()->json(['error' => 'Unauthenticated.'], 401);
        }

        if ($card->tenant_id != $tenantId) {
            abort(403, 'Unauthorized to update this card: Card tenant mismatch.');
        }

        $board = Board::find($card->board_id);
        if (!$user->is_global_admin && (!$board || !$board->members->contains('id', $user->id))) {
            abort(403, 'Unauthorized to update card: You are not a member of the board this card belongs to.');
        }

        Log::info('CardController@update: Attempting to update card.', [
            'card_id' => $card->id,
            'tenant_id_request' => $tenantId,
            'request_data' => $request->all(),
        ]);

        DB::beginTransaction();
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
                'checklist' => 'nullable|json',
            ]);

            if (isset($validated['list_id']) && $validated['list_id'] !== $card->list_id) {
                $newList = LList::find($validated['list_id']);
                if ($newList && $newList->board_id !== $card->board_id) {
                    $validated['board_id'] = $newList->board_id;
                }
            }

            $card->update($validated);

            DB::commit();
            Log::info('Card updated successfully.', ['card_id' => $card->id, 'list_id' => $card->list_id, 'tenant_id' => $card->tenant_id]);
            $card->load('members');
            return response()->json($card);
        } catch (ValidationException $e) {
            DB::rollBack();
            Log::error('Validation failed during card update', ['card_id' => $card->id, 'errors' => $e->errors(), 'request_data' => $request->all()]);
            return response()->json(['error' => 'Validation failed.', 'details' => $e->errors()], 422);
        } catch (\Throwable $e) {
            DB::rollBack();
            Log::error('Unexpected error during card update', ['card_id' => $card->id, 'error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return response()->json(['error' => 'An unexpected error occurred.', 'details' => $e->getMessage()], 500);
        }
    }

    public function destroy(Request $request, Card $card)
    {
        $tenantId = $request->header('X-Tenant-ID');
        $user = $request->user();

        if (!$user) {
            return response()->json(['error' => 'Unauthenticated.'], 401);
        }

        if ($card->tenant_id != $tenantId) {
            abort(403, 'Unauthorized to delete this card: Card tenant mismatch.');
        }

        $board = Board::find($card->board_id);
        if (!$user->is_global_admin && (!$board || !$board->members->contains('id', $user->id))) {
            abort(403, 'Unauthorized to delete card: You are not a member of the board this card belongs to.');
        }

        DB::beginTransaction();
        try {
            $card->delete();
            DB::commit();
            Log::info('Card deleted successfully.', ['card_id' => $card->id, 'list_id' => $card->list_id, 'tenant_id' => $card->tenant_id]);
            return response()->noContent();
        } catch (\Throwable $e) {
            DB::rollBack();
            Log::error('Error deleting card', ['card_id' => $card->id, 'error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return response()->json(['error' => 'Failed to delete card.'], 500);
        }
    }

    public function reorderCardsInList(Request $request, LList $list)
    {
        $tenantId = $request->header('X-Tenant-ID');
        $user = $request->user();

        if (!$user) {
            return response()->json(['error' => 'Unauthenticated.'], 401);
        }

        if ($list->tenant_id != $tenantId) {
            abort(403, 'Unauthorized to reorder cards in this list: List tenant mismatch.');
        }

        $board = Board::find($list->board_id);
        if (!$user->is_global_admin && (!$board || !$board->members->contains('id', $user->id))) {
            abort(403, 'Unauthorized to reorder cards: You are not a member of the board this list belongs to.');
        }

        Log::info('CardController@reorderCardsInList: Attempting to reorder cards in list.', [
            'list_id' => $list->id,
            'tenant_id_request' => $tenantId,
            'request_data' => $request->all(),
        ]);

        try {
            $validatedData = $request->validate([
                'card_ids' => 'nullable|array',
                'card_ids.*' => [
                    'sometimes',
                    'exists:cards,id',
                    Rule::exists('cards', 'id')->where(function ($query) use ($list, $tenantId) {
                        return $query->where('list_id', $list->id)
                                        ->where('tenant_id', $tenantId);
                    }),
                ],
            ]);

            DB::transaction(function () use ($validatedData, $list, $tenantId) {
                if (!empty($validatedData['card_ids'])) {
                    foreach ($validatedData['card_ids'] as $index => $cardId) {
                        Card::where('id', $cardId)
                            ->where('list_id', $list->id)
                            ->where('tenant_id', $tenantId)
                            ->update(['order' => $index]);
                    }
                }
            });

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

    public function syncMembers(Request $request, Card $card)
    {
        $tenantId = $request->header('X-Tenant-ID');
        $user = $request->user();

        if (!$user) {
            return response()->json(['error' => 'Unauthenticated.'], 401);
        }

        if ($card->tenant_id != $tenantId) {
            abort(403, 'Unauthorized access: Card does not belong to the current tenant.');
        }

        $board = Board::find($card->board_id);
        if (!$user->is_global_admin && (!$board || !$board->members->contains('id', $user->id))) {
            abort(403, 'Unauthorized to sync members: You are not a member of the board this card belongs to.');
        }

        $validator = Validator::make($request->all(), [
            'member_ids' => 'nullable|array',
            'member_ids.*' => [
                'integer',
                Rule::exists('users', 'id')->where(function ($query) use ($tenantId) {
                    return $query->where('tenant_id', $tenantId);
                }),
            ],
        ]);

        if ($validator->fails()) {
            Log::error('CardController@syncMembers: Validation failed.', ['card_id' => $card->id, 'errors' => $validator->errors(), 'request_data' => $request->all()]);
            return response()->json(['error' => 'Validation failed.', 'details' => $validator->errors()], 422);
        }

        $memberIds = $request->input('member_ids', []);

        DB::beginTransaction();
        try {
            $card->members()->sync($memberIds);
            $card->load('members');

            if ($board) {
                $board->loadMissing('user');
                $currentBoardMembers = $board->members->pluck('id')->toArray();
                $membersToAddToBoard = array_unique(array_merge($currentBoardMembers, $memberIds));
                
                if ($board->user && !in_array($board->user->id, $membersToAddToBoard)) {
                    $membersToAddToBoard[] = $board->user->id;
                }

                $board->members()->sync($membersToAddToBoard);
            }

            DB::commit();
            Log::info('Card members synchronized successfully and board members updated.', ['card_id' => $card->id, 'member_ids' => $memberIds]);
            return response()->json($card, 200);
        } catch (\Throwable $e) {
            DB::rollBack();
            Log::error('CardController@syncMembers: Unexpected error during member synchronization.', ['card_id' => $card->id, 'error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return response()->json(['error' => 'An unexpected error occurred during member synchronization.', 'details' => $e->getMessage()], 500);
        }
    }
}

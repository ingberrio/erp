<?php
// app/Http/Controllers/LListController.php
namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\LList; // Using LList for the model
use App\Models\Board;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Illuminate\Support\Facades\Log;

class LListController extends Controller
{
    /**
     * Display a listing of the lists for a given board.
     * GET /api/boards/{board}/lists
     */
    public function index(Request $request, Board $board)
    {
        // Ensure the board belongs to the current tenant and user (security check)
        if ($board->tenant_id !== $request->header('X-Tenant-ID') || $board->user_id !== $request->user()->id) {
            abort(403, 'Unauthorized access to board lists.');
        }

        try {
            // Load lists for the specified board, eager load cards and order by 'order'
            $lists = LList::where('board_id', $board->id)
                ->where('tenant_id', $request->header('X-Tenant-ID'))
                ->with(['cards' => function ($query) {
                    $query->orderBy('order'); // Order cards within lists
                }])
                ->orderBy('order')
                ->get();

            return response()->json($lists);
        } catch (\Throwable $e) {
            Log::error('Error fetching lists in index', [
                'board_id' => $board->id,
                'tenant_id' => $request->header('X-Tenant-ID'),
                'error_message' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            return response()->json(['error' => 'Failed to fetch lists.'], 500);
        }
    }

    /**
     * Store a newly created list in storage.
     * POST /api/boards/{board}/lists
     */
    public function store(Request $request, Board $board)
    {
        // Ensure the board belongs to the current tenant and user (security check)
        if ($board->tenant_id !== $request->header('X-Tenant-ID') || $board->user_id !== $request->user()->id) {
            abort(403, 'Unauthorized to create list on this board.');
        }

        try {
            $validated = $request->validate([
                'name' => [
                    'required',
                    'string',
                    'max:255',
                    // Unique list name per board
                    Rule::unique('lists')->where(function ($query) use ($board) {
                        return $query->where('board_id', $board->id);
                    }),
                ],
                'order' => 'integer|min:0', // Optional: frontend can suggest an order, or we auto-assign
            ]);

            // Determine the next order if not provided
            $maxOrder = LList::where('board_id', $board->id)->max('order');
            $order = $validated['order'] ?? ($maxOrder !== null ? $maxOrder + 1 : 0);

            $list = LList::create([
                'name' => $validated['name'],
                'order' => $order,
                'board_id' => $board->id,
                'tenant_id' => $request->header('X-Tenant-ID'), // Inherit tenant from board
            ]);

            Log::info('List created successfully.', ['list_id' => $list->id, 'board_id' => $board->id, 'tenant_id' => $list->tenant_id]);

            return response()->json($list, 201);
        } catch (ValidationException $e) {
            Log::error('Validation failed during list store', ['errors' => $e->errors()]);
            return response()->json(['error' => 'Validation failed.', 'details' => $e->errors()], 422);
        } catch (\Throwable $e) {
            Log::error('Unexpected error during list store', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return response()->json(['error' => 'An unexpected error occurred.', 'details' => $e->getMessage()], 500);
        }
    }

    /**
     * Update the specified list in storage.
     * PUT /api/lists/{list}
     */
    public function update(Request $request, LList $list)
    {
        // Ensure the list belongs to the current tenant and user (security check via its board)
        $board = Board::where('id', $list->board_id)
                      ->where('tenant_id', $request->header('X-Tenant-ID'))
                      ->where('user_id', $request->user()->id)
                      ->first();
        if (!$board) {
            abort(403, 'Unauthorized access to this list.');
        }

        try {
            $validated = $request->validate([
                'name' => [
                    'required',
                    'string',
                    'max:255',
                    Rule::unique('lists')->ignore($list->id)->where(function ($query) use ($list) {
                        return $query->where('board_id', $list->board_id);
                    }),
                ],
                'order' => 'integer|min:0',
            ]);

            $list->update([
                'name' => $validated['name'],
                'order' => $validated['order'] ?? $list->order,
            ]);

            Log::info('List updated successfully.', ['list_id' => $list->id, 'board_id' => $list->board_id, 'tenant_id' => $list->tenant_id]);

            return response()->json($list);
        } catch (ValidationException $e) {
            Log::error('Validation failed during list update', ['list_id' => $list->id, 'errors' => $e->errors()]);
            return response()->json(['error' => 'Validation failed.', 'details' => $e->errors()], 422);
        } catch (\Throwable $e) {
            Log::error('Unexpected error during list update', ['list_id' => $list->id, 'error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return response()->json(['error' => 'An unexpected error occurred.', 'details' => $e->getMessage()], 500);
        }
    }

    /**
     * Remove the specified list from storage.
     * DELETE /api/lists/{list}
     */
    public function destroy(Request $request, LList $list)
    {
        // Ensure the list belongs to the current tenant and user (security check via its board)
        $board = Board::where('id', $list->board_id)
                      ->where('tenant_id', $request->header('X-Tenant-ID'))
                      ->where('user_id', $request->user()->id)
                      ->first();
        if (!$board) {
            abort(403, 'Unauthorized to delete this list.');
        }

        try {
            $list->delete();
            Log::info('List deleted successfully.', ['list_id' => $list->id, 'board_id' => $list->board_id, 'tenant_id' => $list->tenant_id]);

            return response()->noContent();
        } catch (\Throwable $e) {
            Log::error('Error deleting list', ['list_id' => $list->id, 'error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return response()->json(['error' => 'Failed to delete list.'], 500);
        }
    }
}

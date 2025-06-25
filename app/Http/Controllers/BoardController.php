<?php
// app/Http/Controllers/BoardController.php
namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Board;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Auth;

class BoardController extends Controller
{
    /**
     * Display a listing of the boards for the current tenant.
     * GET /api/boards
     */
    public function index(Request $request)
    {
        $tenantId = $request->header('X-Tenant-ID');
        if (!$tenantId) {
            return response()->json(['error' => 'Tenant ID is missing'], 400);
        }

        try {
            // Fetch boards for the current tenant, eager load lists and cards
            $boards = Board::with(['lists.cards' => function ($query) {
                $query->orderBy('order'); // Order cards within lists
            }])
            ->where('tenant_id', (int) $tenantId) // <-- Castear a int aquí también para el filtro
            ->where('user_id', $request->user()->id) // Only boards created by the current user for now
            ->orderBy('created_at', 'desc')
            ->get();

            return response()->json($boards);
        } catch (\Throwable $e) {
            Log::error('Error fetching boards in index', [
                'tenant_id' => $tenantId,
                'user_id' => $request->user()->id,
                'error_message' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            return response()->json(['error' => 'Failed to fetch boards.'], 500);
        }
    }

    /**
     * Store a newly created board in storage.
     * POST /api/boards
     */
    public function store(Request $request)
    {
        $tenantId = $request->header('X-Tenant-ID');
        if (!$tenantId) {
            return response()->json(['error' => 'Tenant ID is missing'], 400);
        }

        try {
            $validated = $request->validate([
                'name' => [
                    'required',
                    'string',
                    'max:255',
                    // Unique board name per tenant and user
                    Rule::unique('boards')->where(function ($query) use ($tenantId, $request) {
                        return $query->where('tenant_id', (int) $tenantId) // <-- Castear a int aquí
                                     ->where('user_id', $request->user()->id);
                    }),
                ],
                'description' => 'nullable|string|max:1000',
            ]);

            $board = Board::create([
                'name' => $validated['name'],
                'description' => $validated['description'] ?? null,
                'tenant_id' => (int) $tenantId, // <-- Castear a int al guardar también para consistencia
                'user_id' => $request->user()->id, // Assign current authenticated user as creator
            ]);

            Log::info('Board created successfully.', ['board_id' => $board->id, 'tenant_id' => $board->tenant_id, 'user_id' => $request->user()->id]);

            return response()->json($board, 201);
        } catch (ValidationException $e) {
            Log::error('Validation failed during board store', ['errors' => $e->errors()]);
            return response()->json(['error' => 'Validation failed.', 'details' => $e->errors()], 422);
        } catch (\Throwable $e) {
            Log::error('Unexpected error during board store', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return response()->json(['error' => 'An unexpected error occurred.', 'details' => $e->getMessage()], 500);
        }
    }

    /**
     * Display the specified board.
     * GET /api/boards/{board}
     */
    public function show(Request $request, Board $board)
    {
        // Debugging logs: CRUCIAL para entender por qué falla
        Log::debug('BoardController@show Debug:', [
            'board_id_from_url' => $board->id,
            'board_tenant_id_from_model' => $board->tenant_id,
            'board_user_id_from_model' => $board->user_id,
            'request_header_x_tenant_id' => $request->header('X-Tenant-ID'), // Se mantiene como string para el log
            'request_user_id_from_auth' => $request->user() ? $request->user()->id : 'N/A (User not authenticated)',
            'auth_check' => Auth::check(),
            'user_is_null' => $request->user() === null,
            // Agregamos las comparaciones con cast para verificar
            'comparison_tenant_id' => $board->tenant_id === (int) $request->header('X-Tenant-ID'),
            'comparison_user_id' => $board->user_id === $request->user()->id,
        ]);


        // Policy or manual check to ensure user has access to this board
        // NOW CASTING THE HEADER TO INT FOR STRICT COMPARISON
        if ($board->tenant_id !== (int) $request->header('X-Tenant-ID') || $board->user_id !== $request->user()->id) {
            Log::warning('BoardController@show UNAUTHORIZED:', [
                'reason' => 'Tenant ID or User ID mismatch',
                'board_tenant_id' => $board->tenant_id,
                'request_tenant_id' => (int) $request->header('X-Tenant-ID'), // Loguea como int para la claridad
                'board_user_id' => $board->user_id,
                'request_user_id' => $request->user() ? $request->user()->id : 'N/A',
            ]);
            abort(403, 'Unauthorized access to board.');
        }

        // Eager load lists and cards for a single board view
        $board->load(['lists.cards' => function ($query) {
            $query->orderBy('order');
        }]);

        return response()->json($board);
    }

    /**
     * Update the specified board in storage.
     * PUT /api/boards/{board}
     */
    public function update(Request $request, Board $board)
    {
        // Cast the header to int for strict comparison
        if ($board->tenant_id !== (int) $request->header('X-Tenant-ID') || $board->user_id !== $request->user()->id) {
            abort(403, 'Unauthorized access to board.');
        }

        try {
            $validated = $request->validate([
                'name' => [
                    'required',
                    'string',
                    'max:255',
                    Rule::unique('boards')->ignore($board->id)->where(function ($query) use ($board, $request) {
                        return $query->where('tenant_id', $board->tenant_id)
                                     ->where('user_id', $request->user()->id);
                    }),
                ],
                'description' => 'nullable|string|max:1000',
            ]);

            $board->update([
                'name' => $validated['name'],
                'description' => $validated['description'] ?? $board->description,
            ]);

            Log::info('Board updated successfully.', ['board_id' => $board->id, 'tenant_id' => $board->tenant_id, 'user_id' => $request->user()->id]);

            return response()->json($board);
        } catch (ValidationException $e) {
            Log::error('Validation failed during board update', ['board_id' => $board->id, 'errors' => $e->errors()]);
            return response()->json(['error' => 'Validation failed.', 'details' => $e->errors()], 422);
        } catch (\Throwable $e) {
            Log::error('Unexpected error during board update', ['board_id' => $board->id, 'error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return response()->json(['error' => 'An unexpected error occurred.', 'details' => $e->getMessage()], 500);
        }
    }

    /**
     * Remove the specified board from storage.
     * DELETE /api/boards/{board}
     */
    public function destroy(Request $request, Board $board)
    {
        // Cast the header to int for strict comparison
        if ($board->tenant_id !== (int) $request->header('X-Tenant-ID') || $board->user_id !== $request->user()->id) {
            abort(403, 'Unauthorized access to board.');
        }

        try {
            $board->delete();
            Log::info('Board deleted successfully.', ['board_id' => $board->id, 'tenant_id' => $board->tenant_id, 'user_id' => $request->user()->id]);

            return response()->noContent();
        } catch (\Throwable $e) {
            Log::error('Error deleting board', ['board_id' => $board->id, 'error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return response()->json(['error' => 'Failed to delete board.'], 500);
        }
    }
}

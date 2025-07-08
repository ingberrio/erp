<?php

namespace App\Http\Controllers;

use App\Models\Board;
use App\Models\User; // Importar el modelo User
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;
use Illuminate\Support\Facades\DB; // Para transacciones
use Illuminate\Support\Facades\Validator; // Para validación manual

class BoardController extends Controller
{
    /**
     * Display a listing of the boards for the authenticated user within their tenant.
     * GET /api/boards
     */
    public function index(Request $request)
    {
        $tenantId = $request->header('X-Tenant-ID');
        $user = $request->user(); // Usuario autenticado

        if (!$user) {
            return response()->json(['error' => 'Unauthenticated.'], 401);
        }

        Log::info('BoardController@index: Fetching boards.', [
            'user_id' => $user->id,
            'tenant_id_request' => $tenantId,
            'is_global_admin' => $user->is_global_admin,
        ]);

        try {
            // Si es un administrador global, puede ver todos los tableros de cualquier tenant
            // (pero el frontend ya debería haber seleccionado un tenant para ver)
            if ($user->is_global_admin) {
                // Aquí, si el Super Admin ha seleccionado un tenant para ver, filtramos por ese.
                // Si no ha seleccionado, debería ver todos los tableros (o el frontend los filtra).
                // Por ahora, asumimos que el frontend envía el X-Tenant-ID correcto para el Super Admin.
                $boards = Board::where('tenant_id', $tenantId)
                               ->with('members') // Cargar los miembros del tablero
                               ->orderBy('created_at', 'desc')
                               ->get();
            } else {
                // Para usuarios de tenant, solo ver los tableros a los que son miembros
                // y que pertenecen a su propio tenant.
                $boards = $user->boards() // Relación de muchos a muchos con boards
                               ->where('boards.tenant_id', $tenantId) // Asegurarse de que el tablero es de su tenant
                               ->with('members') // Cargar los miembros del tablero
                               ->orderBy('boards.created_at', 'desc')
                               ->get();
            }

            Log::info('BoardController@index: Boards fetched successfully.', [
                'user_id' => $user->id,
                'tenant_id' => $tenantId,
                'board_count' => $boards->count(),
                'board_ids' => $boards->pluck('id')->toArray(),
            ]);

            return response()->json($boards);
        } catch (\Throwable $e) {
            Log::error('BoardController@index: Error fetching boards.', [
                'user_id' => $user->id,
                'tenant_id' => $tenantId,
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
        $user = $request->user();

        if (!$user) {
            return response()->json(['error' => 'Unauthenticated.'], 401);
        }

        Log::info('BoardController@store: Attempting to create board.', [
            'user_id' => $user->id,
            'tenant_id_request' => $tenantId,
            'request_data' => $request->all(),
        ]);

        try {
            $validated = $request->validate([
                'name' => 'required|string|max:255',
                'description' => 'nullable|string|max:1000',
                // Para Super Admin, permitir especificar tenant_id. Para usuarios de tenant, usar su propio tenant_id.
                'tenant_id' => [
                    Rule::requiredIf($user->is_global_admin),
                    'nullable', // Permitir nulo si no es global admin y se usará el del usuario
                    'integer',
                    'exists:tenants,id',
                ],
            ]);

            // Determinar el tenant_id final para el tablero
            $boardTenantId = $user->is_global_admin ? $validated['tenant_id'] : $user->tenant_id;

            if (!$boardTenantId) {
                 return response()->json(['error' => 'Tenant ID could not be determined for board creation.'], 400);
            }

            // Iniciar una transacción de base de datos
            DB::beginTransaction();

            $board = Board::create([
                'name' => $validated['name'],
                'description' => $validated['description'] ?? null,
                'tenant_id' => $boardTenantId,
                'user_id' => $user->id, // El creador del tablero
            ]);

            // ¡CRUCIAL! Añadir al creador como miembro del tablero
            $board->members()->attach($user->id);

            DB::commit(); // Confirmar la transacción

            Log::info('Board created successfully.', ['board_id' => $board->id, 'tenant_id' => $board->tenant_id, 'creator_user_id' => $user->id]);

            // Cargar los miembros para la respuesta
            $board->load('members');

            return response()->json($board, 201);
        } catch (ValidationException $e) {
            DB::rollBack(); // Revertir la transacción en caso de error de validación
            Log::error('BoardController@store: Validation failed.', ['errors' => $e->errors(), 'request_data' => $request->all()]);
            return response()->json(['error' => 'Validation failed.', 'details' => $e->errors()], 422);
        } catch (\Throwable $e) {
            DB::rollBack(); // Revertir la transacción en caso de cualquier otro error
            Log::error('BoardController@store: Unexpected error during board creation.', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return response()->json(['error' => 'An unexpected error occurred.', 'details' => $e->getMessage()], 500);
        }
    }

    /**
     * Display the specified board.
     * GET /api/boards/{board}
     */
    public function show(Request $request, Board $board)
    {
        $tenantId = $request->header('X-Tenant-ID');
        $user = $request->user();

        if (!$user) {
            return response()->json(['error' => 'Unauthenticated.'], 401);
        }

        // Verificar que el tablero pertenece al tenant del usuario
        if ($board->tenant_id != $tenantId) {
            abort(403, 'Unauthorized access: Board does not belong to the current tenant.');
        }

        // Verificar que el usuario es miembro del tablero (o es global admin)
        if (!$user->is_global_admin && !$board->members->contains('id', $user->id)) {
            abort(403, 'Unauthorized access: You are not a member of this board.');
        }

        // Cargar los miembros del tablero para la respuesta
        $board->load('members');

        return response()->json($board);
    }

    /**
     * Update the specified board in storage.
     * PUT /api/boards/{board}
     */
    public function update(Request $request, Board $board)
    {
        $tenantId = $request->header('X-Tenant-ID');
        $user = $request->user();

        if (!$user) {
            return response()->json(['error' => 'Unauthenticated.'], 401);
        }

        // Verificar que el tablero pertenece al tenant del usuario
        if ($board->tenant_id != $tenantId) {
            abort(403, 'Unauthorized to update this board: Board tenant mismatch.');
        }

        // Solo el creador o un admin global puede actualizar el tablero
        // Usamos $board->user_id para el creador
        if (!$user->is_global_admin && $board->user_id !== $user->id) {
            abort(403, 'Unauthorized to update this board: Only the creator or a global admin can update.');
        }

        Log::info('BoardController@update: Attempting to update board.', [
            'board_id' => $board->id,
            'tenant_id_request' => $tenantId,
            'user_id' => $user->id,
            'request_data' => $request->all(),
        ]);

        try {
            $validated = $request->validate([
                'name' => 'sometimes|required|string|max:255',
                'description' => 'nullable|string|max:1000',
                // Permitir cambiar el tenant_id solo para Super Admin
                'tenant_id' => [
                    Rule::requiredIf($user->is_global_admin && $request->has('tenant_id')),
                    'nullable',
                    'integer',
                    'exists:tenants,id',
                ],
            ]);

            // Si el Super Admin intenta cambiar el tenant_id
            if ($user->is_global_admin && isset($validated['tenant_id'])) {
                // Asegurarse de que el nuevo tenant_id es válido y diferente
                if ($validated['tenant_id'] !== $board->tenant_id) {
                    // Aquí podrías añadir lógica para mover todas las listas y tarjetas al nuevo tenant_id
                    // Por simplicidad, solo actualizamos el tenant_id del tablero.
                    // Las listas y tarjetas seguirán con el tenant_id antiguo a menos que se actualicen explícitamente.
                    // Esto es un punto a considerar para una implementación más robusta.
                    $board->tenant_id = $validated['tenant_id'];
                }
            }

            $board->update($validated);

            Log::info('Board updated successfully.', ['board_id' => $board->id, 'tenant_id' => $board->tenant_id]);

            // Cargar los miembros para la respuesta
            $board->load('members');

            return response()->json($board);
        } catch (ValidationException $e) {
            Log::error('BoardController@update: Validation failed.', ['board_id' => $board->id, 'errors' => $e->errors(), 'request_data' => $request->all()]);
            return response()->json(['error' => 'Validation failed.', 'details' => $e->errors()], 422);
        } catch (\Throwable $e) {
            Log::error('BoardController@update: Unexpected error during board update.', ['board_id' => $board->id, 'error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return response()->json(['error' => 'An unexpected error occurred.', 'details' => $e->getMessage()], 500);
        }
    }

    /**
     * Remove the specified board from storage.
     * DELETE /api/boards/{board}
     */
    public function destroy(Request $request, Board $board)
    {
        $tenantId = $request->header('X-Tenant-ID');
        $user = $request->user();

        if (!$user) {
            return response()->json(['error' => 'Unauthenticated.'], 401);
        }

        // Verificar que el tablero pertenece al tenant del usuario
        if ($board->tenant_id != $tenantId) {
            abort(403, 'Unauthorized to delete this board: Board tenant mismatch.');
        }

        // Solo el creador o un admin global puede eliminar el tablero
        // Usamos $board->user_id para el creador
        if (!$user->is_global_admin && $board->user_id !== $user->id) {
            abort(403, 'Unauthorized to delete this board: Only the creator or a global admin can delete.');
        }

        try {
            $board->delete();
            Log::info('Board deleted successfully.', ['board_id' => $board->id, 'tenant_id' => $board->tenant_id]);

            return response()->noContent();
        } catch (\Throwable $e) {
            Log::error('BoardController@destroy: Error deleting board.', ['board_id' => $board->id, 'error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return response()->json(['error' => 'Failed to delete board.'], 500);
        }
    }

    /**
     * Sincroniza los miembros asignados a un tablero.
     * POST /api/boards/{board}/members
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  \App\Models\Board  $board
     * @return \Illuminate\Http\Response
     */
    public function syncMembers(Request $request, Board $board)
    {
        $tenantId = $request->header('X-Tenant-ID');
        $user = $request->user();

        if (!$user) {
            return response()->json(['error' => 'Unauthenticated.'], 401);
        }

        // Verificar que el tablero pertenece al tenant del usuario
        if ($board->tenant_id != $tenantId) {
            abort(403, 'Unauthorized access: Board does not belong to the current tenant.');
        }

        // Solo el creador del tablero o un admin global puede sincronizar miembros
        // Usamos $board->user_id para el creador
        if (!$user->is_global_admin && $board->user_id !== $user->id) {
            abort(403, 'Unauthorized: Only the board creator or a global admin can manage members.');
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
            Log::error('BoardController@syncMembers: Validation failed.', ['board_id' => $board->id, 'errors' => $validator->errors(), 'request_data' => $request->all()]);
            return response()->json(['error' => 'Validation failed.', 'details' => $validator->errors()], 422);
        }

        $memberIds = $request->input('member_ids', []);

        try {
            // Asegurarse de que el creador del tablero siempre esté incluido en los miembros
            // Usamos $board->user_id para el creador
            if (!in_array($board->user_id, $memberIds)) {
                $memberIds[] = $board->user_id;
            }

            $board->members()->sync($memberIds);
            $board->load('members');

            Log::info('Board members synchronized successfully.', ['board_id' => $board->id, 'member_ids' => $memberIds]);

            return response()->json($board, 200);
        } catch (\Throwable $e) {
            Log::error('BoardController@syncMembers: Unexpected error during member synchronization.', ['board_id' => $board->id, 'error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return response()->json(['error' => 'An unexpected error occurred during member synchronization.', 'details' => $e->getMessage()], 500);
        }
    }
}

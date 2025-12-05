<?php

namespace App\Http\Controllers;

use App\Models\Variety;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class VarietyController extends Controller
{
    /**
     * Display a listing of varieties.
     */
    public function index(Request $request)
    {
        $user = $request->user();
        $query = Variety::query();

        // Apply tenant filter for non-global admins
        if (!$user->is_global_admin) {
            $query->where('tenant_id', $user->tenant_id);
        } else {
            // Global admin can filter by tenant via header or query parameter
            $tenantId = $request->header('X-Tenant-ID') ?: $request->get('tenant_id');
            if ($tenantId) {
                $query->where('tenant_id', $tenantId);
            }
        }

        // Filter by active status
        if ($request->has('is_active') && $request->is_active !== 'all') {
            $query->where('is_active', $request->is_active === 'true' || $request->is_active === '1');
        }

        // Filter by strain
        if ($request->has('strain') && !empty($request->strain)) {
            $query->whereJsonContains('strain', $request->strain);
        }

        // Search by name
        if ($request->has('search') && !empty($request->search)) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'ilike', "%{$search}%")
                  ->orWhere('description', 'ilike', "%{$search}%");
            });
        }

        // Sorting
        $sortField = $request->get('sort_by', 'id');
        $sortOrder = $request->get('sort_order', 'desc');
        $allowedSortFields = ['id', 'name', 'created_at', 'updated_at'];
        
        if (in_array($sortField, $allowedSortFields)) {
            $query->orderBy($sortField, $sortOrder);
        }

        // Include relationships
        $query->with(['creator:id,name', 'updater:id,name']);

        // Pagination
        $perPage = min($request->get('per_page', 20), 100);
        $varieties = $query->paginate($perPage);

        return response()->json($varieties);
    }

    /**
     * Store a newly created variety.
     */
    public function store(Request $request)
    {
        $user = $request->user();

        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'strain' => 'nullable|array',
            'strain.*' => 'string|in:Indica,Sativa,Hybrid',
            'description' => 'nullable|string|max:1000',
            'thc_range' => 'nullable|string|max:50',
            'cbd_range' => 'nullable|string|max:50',
            'flowering_time_days' => 'nullable|integer|min:1|max:365',
            'yield_potential' => 'nullable|string|in:Low,Medium,High',
            'is_active' => 'boolean',
            'tenant_id' => 'nullable|exists:tenants,id',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $data = $validator->validated();

        // Determine tenant_id
        if ($user->is_global_admin && isset($data['tenant_id'])) {
            // Global admin can specify tenant
        } else {
            $data['tenant_id'] = $user->tenant_id;
        }

        if (!$data['tenant_id']) {
            return response()->json(['message' => 'Tenant ID is required'], 422);
        }

        $variety = Variety::create($data);
        $variety->load(['creator:id,name', 'updater:id,name']);

        return response()->json([
            'message' => 'Variety created successfully',
            'data' => $variety
        ], 201);
    }

    /**
     * Display the specified variety.
     */
    public function show(Request $request, Variety $variety)
    {
        $user = $request->user();

        // Check access
        if (!$user->is_global_admin && $variety->tenant_id !== $user->tenant_id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $variety->load(['creator:id,name', 'updater:id,name', 'tenant:id,name']);

        return response()->json(['data' => $variety]);
    }

    /**
     * Update the specified variety.
     */
    public function update(Request $request, Variety $variety)
    {
        $user = $request->user();

        // Check access
        if (!$user->is_global_admin && $variety->tenant_id !== $user->tenant_id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $validator = Validator::make($request->all(), [
            'name' => 'sometimes|required|string|max:255',
            'strain' => 'nullable|array',
            'strain.*' => 'string|in:Indica,Sativa,Hybrid',
            'description' => 'nullable|string|max:1000',
            'thc_range' => 'nullable|string|max:50',
            'cbd_range' => 'nullable|string|max:50',
            'flowering_time_days' => 'nullable|integer|min:1|max:365',
            'yield_potential' => 'nullable|string|in:Low,Medium,High',
            'is_active' => 'boolean',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $variety->update($validator->validated());
        $variety->load(['creator:id,name', 'updater:id,name']);

        return response()->json([
            'message' => 'Variety updated successfully',
            'data' => $variety
        ]);
    }

    /**
     * Remove the specified variety.
     */
    public function destroy(Request $request, Variety $variety)
    {
        $user = $request->user();

        // Check access
        if (!$user->is_global_admin && $variety->tenant_id !== $user->tenant_id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $variety->delete();

        return response()->json(['message' => 'Variety deleted successfully']);
    }

    /**
     * Get all strains for dropdown
     */
    public function strains()
    {
        return response()->json([
            'data' => ['Indica', 'Sativa', 'Hybrid']
        ]);
    }

    /**
     * Toggle variety active status
     */
    public function toggleActive(Request $request, Variety $variety)
    {
        $user = $request->user();

        // Check access
        if (!$user->is_global_admin && $variety->tenant_id !== $user->tenant_id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $variety->update(['is_active' => !$variety->is_active]);
        $variety->load(['creator:id,name', 'updater:id,name']);

        return response()->json([
            'message' => $variety->is_active ? 'Variety activated' : 'Variety deactivated',
            'data' => $variety
        ]);
    }
}

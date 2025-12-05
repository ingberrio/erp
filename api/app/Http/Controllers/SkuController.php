<?php

namespace App\Http\Controllers;

use App\Models\Sku;
use App\Models\Variety;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class SkuController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        $user = $request->user();
        $tenantId = $request->header('X-Tenant-ID');
        
        // Build query based on user type
        if ($user && $user->is_global_admin) {
            // Global admin can see all SKUs or filter by tenant
            $query = Sku::with(['variety', 'creator', 'updater']);
            if ($tenantId) {
                $query->where('tenant_id', $tenantId);
            }
        } else {
            if (!$tenantId) {
                return response()->json(['error' => 'Tenant ID is required'], 400);
            }
            $query = Sku::where('tenant_id', $tenantId)
                ->with(['variety', 'creator', 'updater']);
        }
        
        // Filter by status
        if ($request->has('status') && $request->status !== 'all') {
            $query->where('status', $request->status);
        }
        
        // Filter by type
        if ($request->has('type') && $request->type !== 'all') {
            $query->where('type', $request->type);
        }
        
        // Filter by sales_class
        if ($request->has('sales_class') && $request->sales_class !== 'all') {
            $query->where('sales_class', $request->sales_class);
        }
        
        // Search by name
        if ($request->has('search') && $request->search) {
            $query->where('name', 'ilike', '%' . $request->search . '%');
        }
        
        $skus = $query->orderBy('created_at', 'desc')->get();
        
        return response()->json($skus);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        $user = $request->user();
        $tenantId = $request->header('X-Tenant-ID') ?: $request->input('tenant_id');
        
        // Global admin can create SKUs for any tenant
        if (!$user->is_global_admin && !$tenantId) {
            return response()->json(['error' => 'Tenant ID is required'], 400);
        }
        
        // For global admin without tenant, require tenant_id in request
        if ($user->is_global_admin && !$tenantId) {
            return response()->json(['error' => 'Please select a tenant first'], 400);
        }
        
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'variety_id' => 'nullable|exists:varieties,id',
            'sales_class' => ['required', Rule::in(['wholesale', 'patient', 'intra-industry', 'recreational'])],
            'gtin_12' => 'nullable|string|max:12',
            'gtin_14' => 'nullable|string|max:14',
            'status' => ['required', Rule::in(['enabled', 'disabled'])],
            'end_type' => 'nullable|string|max:255',
            'cannabis_class' => 'nullable|string|max:255',
            'unit' => ['required', Rule::in(['g', 'kg'])],
            'type' => ['required', Rule::in(['packaged', 'unpackaged'])],
            'unit_quantity' => 'required|numeric|min:0',
            'unit_weight' => 'required|numeric|min:0',
            'total_packaged_weight' => 'nullable|numeric|min:0',
            'estimated_price' => 'nullable|numeric|min:0',
            'cost_per_package' => 'nullable|numeric|min:0',
            'is_ghost_sku' => 'boolean',
        ]);
        
        $validated['tenant_id'] = $tenantId;
        
        // Calculate target weight
        $validated['target_weight'] = $validated['unit_weight'] * $validated['unit_quantity'];
        
        $sku = Sku::create($validated);
        
        return response()->json($sku->load(['variety', 'creator', 'updater']), 201);
    }

    /**
     * Display the specified resource.
     */
    public function show(Request $request, Sku $sku)
    {
        $tenantId = $request->header('X-Tenant-ID');
        
        if ($sku->tenant_id != $tenantId) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }
        
        return response()->json($sku->load(['variety', 'creator', 'updater']));
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, Sku $sku)
    {
        $tenantId = $request->header('X-Tenant-ID');
        
        if ($sku->tenant_id != $tenantId) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }
        
        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'variety_id' => 'nullable|exists:varieties,id',
            'sales_class' => ['sometimes', 'required', Rule::in(['wholesale', 'patient', 'intra-industry', 'recreational'])],
            'gtin_12' => 'nullable|string|max:12',
            'gtin_14' => 'nullable|string|max:14',
            'status' => ['sometimes', 'required', Rule::in(['enabled', 'disabled'])],
            'end_type' => 'nullable|string|max:255',
            'cannabis_class' => 'nullable|string|max:255',
            'unit' => ['sometimes', 'required', Rule::in(['g', 'kg'])],
            'type' => ['sometimes', 'required', Rule::in(['packaged', 'unpackaged'])],
            'unit_quantity' => 'sometimes|required|numeric|min:0',
            'unit_weight' => 'sometimes|required|numeric|min:0',
            'total_packaged_weight' => 'nullable|numeric|min:0',
            'estimated_price' => 'nullable|numeric|min:0',
            'cost_per_package' => 'nullable|numeric|min:0',
            'is_ghost_sku' => 'boolean',
        ]);
        
        // Recalculate target weight if unit_weight or unit_quantity changed
        if (isset($validated['unit_weight']) || isset($validated['unit_quantity'])) {
            $unitWeight = $validated['unit_weight'] ?? $sku->unit_weight;
            $unitQuantity = $validated['unit_quantity'] ?? $sku->unit_quantity;
            $validated['target_weight'] = $unitWeight * $unitQuantity;
        }
        
        $sku->update($validated);
        
        return response()->json($sku->load(['variety', 'creator', 'updater']));
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Request $request, Sku $sku)
    {
        $tenantId = $request->header('X-Tenant-ID');
        
        if ($sku->tenant_id != $tenantId) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }
        
        $sku->delete();
        
        return response()->json(['message' => 'SKU deleted successfully']);
    }

    /**
     * Toggle SKU status
     */
    public function toggleStatus(Request $request, Sku $sku)
    {
        $tenantId = $request->header('X-Tenant-ID');
        
        if ($sku->tenant_id != $tenantId) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }
        
        $sku->status = $sku->status === 'enabled' ? 'disabled' : 'enabled';
        $sku->save();
        
        return response()->json($sku->load(['variety', 'creator', 'updater']));
    }

    /**
     * Get varieties for dropdown
     */
    public function getVarieties(Request $request)
    {
        $tenantId = $request->header('X-Tenant-ID');
        $user = $request->user();
        
        // If user is global admin, get all varieties or filter by selected tenant
        if ($user && $user->is_global_admin) {
            $query = Variety::query();
            if ($tenantId) {
                $query->where('tenant_id', $tenantId);
            }
        } else {
            if (!$tenantId) {
                return response()->json(['error' => 'Tenant ID is required'], 400);
            }
            $query = Variety::where('tenant_id', $tenantId);
        }
        
        $varieties = $query->orderBy('name')
            ->get(['id', 'name', 'strain', 'is_active', 'tenant_id']);
        
        return response()->json($varieties);
    }
}

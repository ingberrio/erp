<?php

namespace App\Http\Controllers;

use App\Models\CrmAccount;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rule;

class CrmAccountController extends Controller
{
    /**
     * Display a listing of accounts.
     */
    public function index(Request $request): JsonResponse
    {
        $user = Auth::user();
        
        $query = CrmAccount::query();

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

        // Filter by status (accept both 'status' and 'account_status' parameters)
        $statusParam = $request->get('account_status') ?: $request->get('status');
        if ($statusParam && $statusParam !== 'all') {
            $query->byStatus($statusParam);
        }

        // Filter by type
        if ($request->has('type') && $request->type !== 'all') {
            $query->byType($request->type);
        }

        // Filter by expiration status
        if ($request->has('expiration_status')) {
            switch ($request->expiration_status) {
                case 'expired':
                    $query->expired();
                    break;
                case 'expiring_soon':
                    $query->expiringSoon();
                    break;
            }
        }

        // Search by name or license number
        if ($request->has('search') && !empty($request->search)) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('license_number', 'like', "%{$search}%")
                  ->orWhere('email', 'like', "%{$search}%");
            });
        }

        // Sorting
        $sortField = $request->get('sort_by', 'id');
        $sortOrder = $request->get('sort_order', 'desc');
        $allowedSortFields = ['id', 'name', 'account_status', 'account_type', 'created_at', 'expiration_date'];
        
        if (in_array($sortField, $allowedSortFields)) {
            $query->orderBy($sortField, $sortOrder);
        }

        // Include creator relationship
        $query->with('creator:id,name');

        // Pagination
        $perPage = $request->get('per_page', 25);
        $accounts = $query->paginate($perPage);

        return response()->json($accounts);
    }

    /**
     * Store a newly created account.
     */
    public function store(Request $request): JsonResponse
    {
        $user = Auth::user();

        $validator = Validator::make($request->all(), [
            'account_type' => ['required', Rule::in(['license_holder', 'supplier', 'distributor', 'retailer', 'other'])],
            'account_status' => ['sometimes', Rule::in(['active', 'pending', 'awaiting_approval', 'approved', 'rejected', 'suspended'])],
            'name' => 'required|string|max:255',
            'phone' => 'nullable|string|max:50',
            'email' => 'nullable|email|max:255',
            'fax' => 'nullable|string|max:50',
            'expiration_date' => 'nullable|date',
            'license_number' => 'nullable|string|max:255',
            // Primary Address
            'address_line1' => 'required|string|max:255',
            'address_line2' => 'nullable|string|max:255',
            'city' => 'required|string|max:100',
            'province' => 'required|string|max:100',
            'postal_code' => 'required|string|max:20',
            'country' => 'required|string|max:100',
            // Shipping Address
            'shipping_same_as_primary' => 'boolean',
            'shipping_address_line1' => 'nullable|string|max:255',
            'shipping_address_line2' => 'nullable|string|max:255',
            'shipping_city' => 'nullable|string|max:100',
            'shipping_province' => 'nullable|string|max:100',
            'shipping_postal_code' => 'nullable|string|max:20',
            'shipping_country' => 'nullable|string|max:100',
            // Additional
            'notes' => 'nullable|string|max:2000',
            'is_active' => 'boolean',
            'tenant_id' => 'nullable|exists:tenants,id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation error',
                'details' => $validator->errors()
            ], 422);
        }

        $data = $validator->validated();

        // Set tenant_id
        if ($user->is_global_admin && isset($data['tenant_id'])) {
            // Global admin can specify tenant
        } elseif ($user->is_global_admin) {
            $tenantId = $request->header('X-Tenant-ID');
            if (!$tenantId) {
                return response()->json(['message' => 'Tenant ID is required for global admin'], 422);
            }
            $data['tenant_id'] = $tenantId;
        } else {
            $data['tenant_id'] = $user->tenant_id;
        }

        $data['created_by'] = $user->id;

        $account = CrmAccount::create($data);

        return response()->json($account->load('creator:id,name'), 201);
    }

    /**
     * Display the specified account.
     */
    public function show(CrmAccount $account): JsonResponse
    {
        $user = Auth::user();

        // Check access
        if (!$user->is_global_admin && $account->tenant_id !== $user->tenant_id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        return response()->json($account->load('creator:id,name'));
    }

    /**
     * Update the specified account.
     */
    public function update(Request $request, CrmAccount $account): JsonResponse
    {
        $user = Auth::user();

        // Check access
        if (!$user->is_global_admin && $account->tenant_id !== $user->tenant_id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $validator = Validator::make($request->all(), [
            'account_type' => ['sometimes', 'required', Rule::in(['license_holder', 'supplier', 'distributor', 'retailer', 'other'])],
            'account_status' => ['sometimes', Rule::in(['active', 'pending', 'awaiting_approval', 'approved', 'rejected', 'suspended'])],
            'name' => 'sometimes|required|string|max:255',
            'phone' => 'nullable|string|max:50',
            'email' => 'nullable|email|max:255',
            'fax' => 'nullable|string|max:50',
            'expiration_date' => 'nullable|date',
            'license_number' => 'nullable|string|max:255',
            // Primary Address
            'address_line1' => 'sometimes|required|string|max:255',
            'address_line2' => 'nullable|string|max:255',
            'city' => 'sometimes|required|string|max:100',
            'province' => 'sometimes|required|string|max:100',
            'postal_code' => 'sometimes|required|string|max:20',
            'country' => 'sometimes|required|string|max:100',
            // Shipping Address
            'shipping_same_as_primary' => 'boolean',
            'shipping_address_line1' => 'nullable|string|max:255',
            'shipping_address_line2' => 'nullable|string|max:255',
            'shipping_city' => 'nullable|string|max:100',
            'shipping_province' => 'nullable|string|max:100',
            'shipping_postal_code' => 'nullable|string|max:20',
            'shipping_country' => 'nullable|string|max:100',
            // Additional
            'notes' => 'nullable|string|max:2000',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation error',
                'details' => $validator->errors()
            ], 422);
        }

        $account->update($validator->validated());

        return response()->json($account->fresh()->load('creator:id,name'));
    }

    /**
     * Remove the specified account.
     */
    public function destroy(CrmAccount $account): JsonResponse
    {
        $user = Auth::user();

        // Check access
        if (!$user->is_global_admin && $account->tenant_id !== $user->tenant_id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        // Check if account has related orders
        if ($account->orders()->count() > 0) {
            return response()->json([
                'message' => 'Cannot delete account with existing orders. Please delete orders first or archive the account.'
            ], 409);
        }

        $account->delete();

        return response()->json(['message' => 'Account deleted successfully']);
    }

    /**
     * Get account statistics.
     */
    public function statistics(Request $request): JsonResponse
    {
        $user = Auth::user();

        $query = CrmAccount::query();

        if (!$user->is_global_admin) {
            $query->where('tenant_id', $user->tenant_id);
        } else {
            $tenantId = $request->header('X-Tenant-ID');
            if ($tenantId) {
                $query->where('tenant_id', $tenantId);
            }
        }

        $stats = [
            'total' => (clone $query)->count(),
            'by_status' => [
                'pending' => (clone $query)->byStatus('pending')->count(),
                'awaiting_approval' => (clone $query)->byStatus('awaiting_approval')->count(),
                'approved' => (clone $query)->byStatus('approved')->count(),
                'rejected' => (clone $query)->byStatus('rejected')->count(),
                'suspended' => (clone $query)->byStatus('suspended')->count(),
            ],
            'by_type' => [
                'license_holder' => (clone $query)->byType('license_holder')->count(),
                'supplier' => (clone $query)->byType('supplier')->count(),
                'distributor' => (clone $query)->byType('distributor')->count(),
                'retailer' => (clone $query)->byType('retailer')->count(),
                'other' => (clone $query)->byType('other')->count(),
            ],
            'expired' => (clone $query)->expired()->count(),
            'expiring_soon' => (clone $query)->expiringSoon()->count(),
        ];

        return response()->json($stats);
    }

    /**
     * Bulk update account status.
     */
    public function bulkUpdateStatus(Request $request): JsonResponse
    {
        $user = Auth::user();

        $validator = Validator::make($request->all(), [
            'account_ids' => 'required|array|min:1',
            'account_ids.*' => 'exists:crm_accounts,id',
            'status' => ['required', Rule::in(['pending', 'awaiting_approval', 'approved', 'rejected', 'suspended'])],
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation error',
                'details' => $validator->errors()
            ], 422);
        }

        $query = CrmAccount::whereIn('id', $request->account_ids);

        if (!$user->is_global_admin) {
            $query->where('tenant_id', $user->tenant_id);
        }

        $updated = $query->update(['account_status' => $request->status]);

        return response()->json([
            'message' => "Successfully updated {$updated} accounts",
            'updated_count' => $updated
        ]);
    }
}

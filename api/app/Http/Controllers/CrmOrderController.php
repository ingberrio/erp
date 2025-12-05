<?php

namespace App\Http\Controllers;

use App\Models\CrmOrder;
use App\Models\CrmAccount;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rule;

class CrmOrderController extends Controller
{
    /**
     * Display a listing of orders.
     */
    public function index(Request $request): JsonResponse
    {
        $user = Auth::user();
        
        $query = CrmOrder::query();

        // Apply tenant filter for non-global admins
        if (!$user->is_global_admin) {
            $query->where('tenant_id', $user->tenant_id);
        } else {
            // Global admin can filter by tenant via header
            $tenantId = $request->header('X-Tenant-ID');
            if ($tenantId) {
                $query->where('tenant_id', $tenantId);
            }
        }

        // Filter by status
        if ($request->has('status') && $request->status !== 'all') {
            $query->byStatus($request->status);
        }

        // Filter by order type
        if ($request->has('order_type') && $request->order_type !== 'all') {
            $query->byOrderType($request->order_type);
        }

        // Filter by shipping status
        if ($request->has('shipping_status') && $request->shipping_status !== 'all') {
            $query->byShippingStatus($request->shipping_status);
        }

        // Filter by account
        if ($request->has('account_id') && !empty($request->account_id)) {
            $query->byAccount($request->account_id);
        }

        // Search by PO number, customer license, or order placed by
        if ($request->has('search') && !empty($request->search)) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('purchase_order', 'like', "%{$search}%")
                  ->orWhere('customer_license', 'like', "%{$search}%")
                  ->orWhere('order_placed_by', 'like', "%{$search}%");
            });
        }

        // Date range filter
        if ($request->has('date_from') && !empty($request->date_from)) {
            $query->whereDate('received_date', '>=', $request->date_from);
        }
        if ($request->has('date_to') && !empty($request->date_to)) {
            $query->whereDate('received_date', '<=', $request->date_to);
        }

        // Sorting
        $sortField = $request->get('sort_by', 'id');
        $sortOrder = $request->get('sort_order', 'desc');
        $allowedSortFields = ['id', 'order_status', 'shipping_status', 'received_date', 'due_date', 'total', 'created_at'];
        
        if (in_array($sortField, $allowedSortFields)) {
            $query->orderBy($sortField, $sortOrder);
        }

        // Include relationships
        $query->with(['account:id,name,address_line1,city', 'creator:id,name']);

        // Grouping by address (for UI display)
        if ($request->has('group_by') && $request->group_by === 'address') {
            // Return with grouping info
            $perPage = $request->get('per_page', 50);
            $orders = $query->paginate($perPage);
            
            return response()->json($orders);
        }

        // Pagination
        $perPage = $request->get('per_page', 25);
        $orders = $query->paginate($perPage);

        return response()->json($orders);
    }

    /**
     * Store a newly created order.
     */
    public function store(Request $request): JsonResponse
    {
        $user = Auth::user();

        $validator = Validator::make($request->all(), [
            'account_id' => 'required|exists:crm_accounts,id',
            'order_status' => ['sometimes', Rule::in(['draft', 'pending', 'approved', 'rejected', 'cancelled', 'completed'])],
            'order_type' => ['required', Rule::in(['intra-industry', 'retail', 'medical', 'export', 'other'])],
            'shipping_status' => ['sometimes', Rule::in(['pending', 'processing', 'packaged', 'shipped', 'delivered', 'returned'])],
            'order_placed_by' => 'nullable|string|max:255',
            'received_date' => 'nullable|date',
            'due_date' => 'nullable|date|after_or_equal:received_date',
            'purchase_order' => 'nullable|string|max:255',
            // Shipping Address
            'shipping_address_line1' => 'nullable|string|max:255',
            'shipping_address_line2' => 'nullable|string|max:255',
            'shipping_city' => 'nullable|string|max:100',
            'shipping_province' => 'nullable|string|max:100',
            'shipping_postal_code' => 'nullable|string|max:20',
            'shipping_country' => 'nullable|string|max:100',
            // Financial
            'subtotal' => 'nullable|numeric|min:0',
            'tax_amount' => 'nullable|numeric|min:0',
            'shipping_cost' => 'nullable|numeric|min:0',
            'discount_amount' => 'nullable|numeric|min:0',
            'currency' => 'nullable|string|max:3',
            // License
            'customer_license' => 'nullable|string|max:255',
            'is_oversold' => 'sometimes|boolean',
            // Additional
            'notes' => 'nullable|string',
            'internal_notes' => 'nullable|string',
            // Tenant (for global admin)
            'tenant_id' => 'nullable|exists:tenants,id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'details' => $validator->errors()
            ], 422);
        }

        // Determine tenant_id
        $tenantId = $user->tenant_id;
        if ($user->is_global_admin) {
            if ($request->has('tenant_id')) {
                $tenantId = $request->tenant_id;
            } elseif ($request->header('X-Tenant-ID')) {
                $tenantId = $request->header('X-Tenant-ID');
            } else {
                return response()->json([
                    'message' => 'Tenant ID is required for global admin'
                ], 400);
            }
        }

        // Verify account belongs to the same tenant
        $account = CrmAccount::withoutGlobalScopes()->find($request->account_id);
        if (!$account || $account->tenant_id != $tenantId) {
            return response()->json([
                'message' => 'Account not found or does not belong to the selected tenant'
            ], 400);
        }

        // Create the order
        $data = $validator->validated();
        $data['tenant_id'] = $tenantId;
        $data['created_by'] = $user->id;
        
        // Calculate total if financial fields provided
        if (isset($data['subtotal'])) {
            $data['total'] = ($data['subtotal'] ?? 0) 
                           + ($data['tax_amount'] ?? 0) 
                           + ($data['shipping_cost'] ?? 0) 
                           - ($data['discount_amount'] ?? 0);
        }

        // If no shipping address provided, use account's shipping address
        if (empty($data['shipping_address_line1'])) {
            if ($account->shipping_same_as_primary) {
                $data['shipping_address_line1'] = $account->address_line1;
                $data['shipping_address_line2'] = $account->address_line2;
                $data['shipping_city'] = $account->city;
                $data['shipping_province'] = $account->province;
                $data['shipping_postal_code'] = $account->postal_code;
                $data['shipping_country'] = $account->country;
            } else {
                $data['shipping_address_line1'] = $account->shipping_address_line1;
                $data['shipping_address_line2'] = $account->shipping_address_line2;
                $data['shipping_city'] = $account->shipping_city;
                $data['shipping_province'] = $account->shipping_province;
                $data['shipping_postal_code'] = $account->shipping_postal_code;
                $data['shipping_country'] = $account->shipping_country;
            }
        }

        $order = CrmOrder::create($data);

        return response()->json([
            'message' => 'Order created successfully',
            'data' => $order->load(['account:id,name', 'creator:id,name'])
        ], 201);
    }

    /**
     * Display the specified order.
     */
    public function show(CrmOrder $order): JsonResponse
    {
        $user = Auth::user();

        // Check tenant access
        if (!$user->is_global_admin && $order->tenant_id !== $user->tenant_id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $order->load(['account', 'creator:id,name', 'approver:id,name', 'tenant:id,name']);

        return response()->json([
            'data' => $order
        ]);
    }

    /**
     * Update the specified order.
     */
    public function update(Request $request, CrmOrder $order): JsonResponse
    {
        $user = Auth::user();

        // Check tenant access
        if (!$user->is_global_admin && $order->tenant_id !== $user->tenant_id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $validator = Validator::make($request->all(), [
            'account_id' => 'sometimes|exists:crm_accounts,id',
            'order_status' => ['sometimes', Rule::in(['draft', 'pending', 'approved', 'rejected', 'cancelled', 'completed'])],
            'order_type' => ['sometimes', Rule::in(['intra-industry', 'retail', 'medical', 'export', 'other'])],
            'shipping_status' => ['sometimes', Rule::in(['pending', 'processing', 'packaged', 'shipped', 'delivered', 'returned'])],
            'order_placed_by' => 'nullable|string|max:255',
            'received_date' => 'nullable|date',
            'due_date' => 'nullable|date',
            'purchase_order' => 'nullable|string|max:255',
            // Shipping Address
            'shipping_address_line1' => 'nullable|string|max:255',
            'shipping_address_line2' => 'nullable|string|max:255',
            'shipping_city' => 'nullable|string|max:100',
            'shipping_province' => 'nullable|string|max:100',
            'shipping_postal_code' => 'nullable|string|max:20',
            'shipping_country' => 'nullable|string|max:100',
            // Financial
            'subtotal' => 'nullable|numeric|min:0',
            'tax_amount' => 'nullable|numeric|min:0',
            'shipping_cost' => 'nullable|numeric|min:0',
            'discount_amount' => 'nullable|numeric|min:0',
            'currency' => 'nullable|string|max:3',
            // License
            'customer_license' => 'nullable|string|max:255',
            'is_oversold' => 'sometimes|boolean',
            // Additional
            'notes' => 'nullable|string',
            'internal_notes' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'details' => $validator->errors()
            ], 422);
        }

        $data = $validator->validated();

        // Handle approval
        if (isset($data['order_status']) && $data['order_status'] === 'approved' && $order->order_status !== 'approved') {
            $data['approved_by'] = $user->id;
            $data['approved_at'] = now();
        }

        // Recalculate total if financial fields changed
        if (isset($data['subtotal']) || isset($data['tax_amount']) || isset($data['shipping_cost']) || isset($data['discount_amount'])) {
            $subtotal = $data['subtotal'] ?? $order->subtotal;
            $tax = $data['tax_amount'] ?? $order->tax_amount;
            $shipping = $data['shipping_cost'] ?? $order->shipping_cost;
            $discount = $data['discount_amount'] ?? $order->discount_amount;
            $data['total'] = $subtotal + $tax + $shipping - $discount;
        }

        $order->update($data);

        return response()->json([
            'message' => 'Order updated successfully',
            'data' => $order->fresh()->load(['account:id,name', 'creator:id,name'])
        ]);
    }

    /**
     * Remove the specified order.
     */
    public function destroy(CrmOrder $order): JsonResponse
    {
        $user = Auth::user();

        // Check tenant access
        if (!$user->is_global_admin && $order->tenant_id !== $user->tenant_id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        // Soft delete
        $order->delete();

        return response()->json([
            'message' => 'Order deleted successfully'
        ]);
    }

    /**
     * Get orders summary/stats
     */
    public function summary(Request $request): JsonResponse
    {
        $user = Auth::user();
        
        $query = CrmOrder::query();

        if (!$user->is_global_admin) {
            $query->where('tenant_id', $user->tenant_id);
        } else {
            $tenantId = $request->header('X-Tenant-ID');
            if ($tenantId) {
                $query->where('tenant_id', $tenantId);
            }
        }

        $summary = [
            'total_orders' => (clone $query)->count(),
            'pending_orders' => (clone $query)->where('order_status', 'pending')->count(),
            'approved_orders' => (clone $query)->where('order_status', 'approved')->count(),
            'shipped_orders' => (clone $query)->where('shipping_status', 'shipped')->count(),
            'total_revenue' => (clone $query)->where('order_status', 'approved')->sum('total'),
            'pending_revenue' => (clone $query)->where('order_status', 'pending')->sum('total'),
        ];

        return response()->json([
            'data' => $summary
        ]);
    }

    /**
     * Approve an order
     */
    public function approve(CrmOrder $order): JsonResponse
    {
        $user = Auth::user();

        if (!$user->is_global_admin && $order->tenant_id !== $user->tenant_id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        if ($order->order_status === 'approved') {
            return response()->json(['message' => 'Order is already approved'], 400);
        }

        $order->update([
            'order_status' => 'approved',
            'approved_by' => $user->id,
            'approved_at' => now(),
        ]);

        return response()->json([
            'message' => 'Order approved successfully',
            'data' => $order->fresh()->load(['account:id,name', 'approver:id,name'])
        ]);
    }

    /**
     * Update shipping status
     */
    public function updateShippingStatus(Request $request, CrmOrder $order): JsonResponse
    {
        $user = Auth::user();

        if (!$user->is_global_admin && $order->tenant_id !== $user->tenant_id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $validator = Validator::make($request->all(), [
            'shipping_status' => ['required', Rule::in(['pending', 'processing', 'packaged', 'shipped', 'delivered', 'returned'])],
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'details' => $validator->errors()
            ], 422);
        }

        $order->update([
            'shipping_status' => $request->shipping_status,
        ]);

        return response()->json([
            'message' => 'Shipping status updated successfully',
            'data' => $order->fresh()
        ]);
    }
}

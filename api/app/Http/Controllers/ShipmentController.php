<?php

namespace App\Http\Controllers;

use App\Models\Shipment;
use App\Models\ShipmentItem;
use App\Models\CrmOrder;
use App\Models\CrmOrderItem;
use App\Models\TraceabilityEvent;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class ShipmentController extends Controller
{
    /**
     * List shipments
     */
    public function index(Request $request)
    {
        $query = Shipment::with(['order.account', 'facility', 'items']);

        if ($request->has('order_id')) {
            $query->where('order_id', $request->order_id);
        }

        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        if ($request->has('facility_id')) {
            $query->where('facility_id', $request->facility_id);
        }

        $shipments = $query->orderBy('created_at', 'desc')->paginate(20);

        return response()->json($shipments);
    }

    /**
     * Get single shipment
     */
    public function show(Shipment $shipment)
    {
        return response()->json(
            $shipment->load(['order.account', 'items.batch', 'items.orderItem', 'facility', 'creator', 'shipper'])
        );
    }

    /**
     * Create shipment for order
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'order_id' => 'required|exists:crm_orders,id',
            'facility_id' => 'nullable|exists:facilities,id',
            'carrier_name' => 'nullable|string|max:100',
            'carrier_service' => 'nullable|string|max:100',
            'tracking_number' => 'nullable|string|max:255',
            'estimated_ship_date' => 'nullable|date',
            'estimated_delivery_date' => 'nullable|date',
            'ship_to_name' => 'nullable|string|max:255',
            'ship_to_company' => 'nullable|string|max:255',
            'ship_to_address_line1' => 'nullable|string|max:255',
            'ship_to_address_line2' => 'nullable|string|max:255',
            'ship_to_city' => 'nullable|string|max:100',
            'ship_to_province' => 'nullable|string|max:100',
            'ship_to_postal_code' => 'nullable|string|max:20',
            'ship_to_country' => 'nullable|string|max:100',
            'ship_to_phone' => 'nullable|string|max:50',
            'ship_to_email' => 'nullable|email',
            'special_instructions' => 'nullable|string',
            'internal_notes' => 'nullable|string',
            'items' => 'nullable|array',
            'items.*.order_item_id' => 'required_with:items|exists:crm_order_items,id',
            'items.*.quantity_shipped' => 'required_with:items|numeric|min:0',
        ]);

        $order = CrmOrder::find($validated['order_id']);

        try {
            DB::beginTransaction();

            $shipment = new Shipment($validated);
            $shipment->tenant_id = $order->tenant_id;
            $shipment->created_by = auth()->id();
            
            // Generate manifest number for Health Canada
            $shipment->manifest_number = Shipment::generateManifestNumber($order->tenant_id);
            
            // Copy address from order if not provided
            if (empty($validated['ship_to_address_line1'])) {
                $shipment->copyAddressFromOrder();
            }
            
            $shipment->save();

            // Add items if provided
            if (!empty($validated['items'])) {
                foreach ($validated['items'] as $itemData) {
                    $orderItem = CrmOrderItem::find($itemData['order_item_id']);
                    
                    if ($orderItem->order_id !== $order->id) {
                        continue;
                    }

                    $shipmentItem = new ShipmentItem([
                        'tenant_id' => $order->tenant_id,
                        'shipment_id' => $shipment->id,
                        'order_item_id' => $orderItem->id,
                        'batch_id' => $orderItem->batch_id,
                        'quantity_shipped' => $itemData['quantity_shipped'],
                        'unit' => $orderItem->unit,
                        'product_name' => $orderItem->product_name,
                        'batch_lot_number' => $orderItem->batch_lot_number,
                        'batch_expiry_date' => $orderItem->batch_expiry_date,
                    ]);
                    $shipmentItem->save();

                    // Update order item shipped quantity
                    $orderItem->quantity_shipped += $itemData['quantity_shipped'];
                    $orderItem->status = 'shipped';
                    $orderItem->save();
                }
            }

            DB::commit();

            return response()->json([
                'message' => 'Shipment created successfully',
                'shipment' => $shipment->load(['items', 'order'])
            ], 201);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Error creating shipment', ['error' => $e->getMessage()]);
            return response()->json(['error' => 'Failed to create shipment', 'message' => $e->getMessage()], 500);
        }
    }

    /**
     * Update shipment
     */
    public function update(Request $request, Shipment $shipment)
    {
        $validated = $request->validate([
            'carrier_name' => 'nullable|string|max:100',
            'carrier_service' => 'nullable|string|max:100',
            'tracking_number' => 'nullable|string|max:255',
            'tracking_url' => 'nullable|url',
            'status' => 'nullable|in:draft,pending,label_created,picked_up,in_transit,out_for_delivery,delivered,exception,returned,cancelled',
            'estimated_ship_date' => 'nullable|date',
            'actual_ship_date' => 'nullable|date',
            'estimated_delivery_date' => 'nullable|date',
            'actual_delivery_date' => 'nullable|date',
            'ship_to_name' => 'nullable|string|max:255',
            'ship_to_address_line1' => 'nullable|string|max:255',
            'ship_to_city' => 'nullable|string|max:100',
            'ship_to_province' => 'nullable|string|max:100',
            'ship_to_postal_code' => 'nullable|string|max:20',
            'package_count' => 'nullable|integer|min:1',
            'total_weight' => 'nullable|numeric|min:0',
            'shipping_cost' => 'nullable|numeric|min:0',
            'special_instructions' => 'nullable|string',
            'internal_notes' => 'nullable|string',
        ]);

        try {
            $shipment->update($validated);

            // Update order shipping status based on shipment status
            if (isset($validated['status'])) {
                $order = $shipment->order;
                
                if ($validated['status'] === 'in_transit') {
                    $order->shipping_status = 'shipped';
                    $shipment->shipped_by = auth()->id();
                } elseif ($validated['status'] === 'delivered') {
                    $order->shipping_status = 'delivered';
                }
                
                $order->save();
            }

            return response()->json([
                'message' => 'Shipment updated successfully',
                'shipment' => $shipment->fresh()->load(['items', 'order'])
            ]);

        } catch (\Exception $e) {
            Log::error('Error updating shipment', ['error' => $e->getMessage()]);
            return response()->json(['error' => 'Failed to update shipment', 'message' => $e->getMessage()], 500);
        }
    }

    /**
     * Mark shipment as shipped
     */
    public function ship(Request $request, Shipment $shipment)
    {
        if (!$shipment->canShip()) {
            return response()->json([
                'error' => 'Cannot ship',
                'message' => 'Shipment is not in a shippable status.'
            ], 422);
        }

        $validated = $request->validate([
            'tracking_number' => 'nullable|string|max:255',
            'carrier_name' => 'nullable|string|max:100',
        ]);

        try {
            DB::beginTransaction();

            if (!empty($validated['tracking_number'])) {
                $shipment->tracking_number = $validated['tracking_number'];
            }
            if (!empty($validated['carrier_name'])) {
                $shipment->carrier_name = $validated['carrier_name'];
            }

            $shipment->markAsShipped(auth()->id());

            // Create traceability events for each batch
            foreach ($shipment->items as $item) {
                if ($item->batch_id) {
                    TraceabilityEvent::create([
                        'batch_id' => $item->batch_id,
                        'event_type' => 'shipment',
                        'description' => "🚚 SHIPPED: {$item->quantity_shipped} {$item->unit} via {$shipment->carrier_name}. Tracking: {$shipment->tracking_number}. Manifest: {$shipment->manifest_number}",
                        'quantity' => -$item->quantity_shipped,
                        'unit' => $item->unit,
                        'facility_id' => $shipment->facility_id,
                        'user_id' => auth()->id(),
                        'tenant_id' => $shipment->tenant_id,
                        'to_location' => $shipment->ship_to_city . ', ' . $shipment->ship_to_province,
                    ]);
                }
            }

            // Update order status
            $order = $shipment->order;
            $order->shipping_status = 'shipped';
            $order->save();

            DB::commit();

            return response()->json([
                'message' => 'Shipment marked as shipped',
                'shipment' => $shipment->fresh()->load(['items', 'order'])
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Error shipping', ['error' => $e->getMessage()]);
            return response()->json(['error' => 'Failed to ship', 'message' => $e->getMessage()], 500);
        }
    }

    /**
     * Mark shipment as delivered
     */
    public function deliver(Request $request, Shipment $shipment)
    {
        $validated = $request->validate([
            'signed_by' => 'nullable|string|max:255',
            'delivery_notes' => 'nullable|string',
        ]);

        try {
            DB::beginTransaction();

            $shipment->markAsDelivered(
                $validated['signed_by'] ?? null,
                $validated['delivery_notes'] ?? null
            );

            // Update order item statuses
            foreach ($shipment->items as $item) {
                $orderItem = $item->orderItem;
                $orderItem->status = 'delivered';
                $orderItem->save();

                // Create traceability event
                if ($item->batch_id) {
                    TraceabilityEvent::create([
                        'batch_id' => $item->batch_id,
                        'event_type' => 'delivery',
                        'description' => "✅ DELIVERED: {$item->quantity_shipped} {$item->unit} to {$shipment->ship_to_name}. Signed by: {$shipment->signed_by}",
                        'quantity' => 0,
                        'unit' => $item->unit,
                        'facility_id' => $shipment->facility_id,
                        'user_id' => auth()->id(),
                        'tenant_id' => $shipment->tenant_id,
                    ]);
                }
            }

            // Update order status
            $order = $shipment->order;
            $allDelivered = $order->shipments()->where('status', '!=', 'delivered')->count() === 0;
            if ($allDelivered) {
                $order->shipping_status = 'delivered';
                
                // Check if order is fully paid to mark as completed
                if ($order->is_fully_paid) {
                    $order->order_status = 'completed';
                }
            }
            $order->save();

            DB::commit();

            return response()->json([
                'message' => 'Shipment marked as delivered',
                'shipment' => $shipment->fresh()->load(['items', 'order'])
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Error marking delivered', ['error' => $e->getMessage()]);
            return response()->json(['error' => 'Failed to mark as delivered', 'message' => $e->getMessage()], 500);
        }
    }

    /**
     * Delete shipment
     */
    public function destroy(Shipment $shipment)
    {
        if ($shipment->status !== 'draft') {
            return response()->json([
                'error' => 'Cannot delete',
                'message' => 'Only draft shipments can be deleted.'
            ], 422);
        }

        try {
            DB::beginTransaction();

            // Restore order item quantities
            foreach ($shipment->items as $item) {
                $orderItem = $item->orderItem;
                $orderItem->quantity_shipped -= $item->quantity_shipped;
                $orderItem->save();
            }

            $shipment->items()->delete();
            $shipment->delete();

            DB::commit();

            return response()->json(['message' => 'Shipment deleted successfully']);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Error deleting shipment', ['error' => $e->getMessage()]);
            return response()->json(['error' => 'Failed to delete shipment', 'message' => $e->getMessage()], 500);
        }
    }

    /**
     * Get shipment statuses
     */
    public function statuses()
    {
        return response()->json([
            'statuses' => Shipment::STATUSES,
            'carriers' => Shipment::CARRIERS,
        ]);
    }
}

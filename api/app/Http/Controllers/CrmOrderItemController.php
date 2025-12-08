<?php

namespace App\Http\Controllers;

use App\Models\CrmOrder;
use App\Models\CrmOrderItem;
use App\Models\Batch;
use App\Models\Sku;
use App\Models\TraceabilityEvent;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class CrmOrderItemController extends Controller
{
    /**
     * Get all items for an order
     */
    public function index(Request $request, CrmOrder $order)
    {
        $items = $order->items()
            ->with(['batch', 'sku'])
            ->orderBy('sort_order')
            ->get();

        return response()->json($items);
    }

    /**
     * Add item to order
     */
    public function store(Request $request, CrmOrder $order)
    {
        $validated = $request->validate([
            'batch_id' => 'nullable|exists:batches,id',
            'sku_id' => 'nullable|exists:skus,id',
            'product_name' => 'required|string|max:255',
            'product_sku' => 'nullable|string|max:100',
            'variety' => 'nullable|string|max:100',
            'product_type' => 'nullable|string|max:100',
            'quantity_ordered' => 'required|numeric|min:0.01',
            'unit' => 'required|string|max:20',
            'unit_price' => 'required|numeric|min:0',
            'discount_percent' => 'nullable|numeric|min:0|max:100',
            'discount_amount' => 'nullable|numeric|min:0',
            'tax_rate' => 'nullable|numeric|min:0|max:100',
            'notes' => 'nullable|string',
        ]);

        // Validate batch availability if specified
        if (!empty($validated['batch_id'])) {
            $batch = Batch::find($validated['batch_id']);
            
            if ($batch->is_recalled) {
                return response()->json([
                    'error' => 'Batch is recalled',
                    'message' => "Batch {$batch->name} is recalled and cannot be added to orders."
                ], 422);
            }
            
            if ($batch->is_archived) {
                return response()->json([
                    'error' => 'Batch is archived',
                    'message' => "Batch {$batch->name} is archived."
                ], 422);
            }
            
            if (in_array($batch->status, ['destroyed', 'sold', 'quarantine'])) {
                return response()->json([
                    'error' => 'Batch not available',
                    'message' => "Batch {$batch->name} has status '{$batch->status}' and is not available."
                ], 422);
            }
            
            if ($batch->current_units < $validated['quantity_ordered']) {
                return response()->json([
                    'error' => 'Insufficient quantity',
                    'message' => "Batch {$batch->name} has only {$batch->current_units} units available."
                ], 422);
            }

            // Auto-fill from batch
            $validated['batch_lot_number'] = $batch->name;
            $validated['variety'] = $validated['variety'] ?? $batch->variety;
            $validated['product_type'] = $validated['product_type'] ?? $batch->product_type;
        }

        try {
            DB::beginTransaction();

            $item = new CrmOrderItem($validated);
            $item->tenant_id = $order->tenant_id;
            $item->order_id = $order->id;
            $item->sort_order = $order->items()->count();
            $item->calculateTotal();
            $item->save();

            // Recalculate order totals
            $order->recalculateFromItems();

            DB::commit();

            return response()->json([
                'message' => 'Item added to order successfully',
                'item' => $item->load(['batch', 'sku']),
                'order' => $order->fresh()
            ], 201);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Error adding order item', ['error' => $e->getMessage()]);
            return response()->json(['error' => 'Failed to add item', 'message' => $e->getMessage()], 500);
        }
    }

    /**
     * Update order item
     */
    public function update(Request $request, CrmOrder $order, CrmOrderItem $item)
    {
        if ($item->order_id !== $order->id) {
            return response()->json(['error' => 'Item does not belong to this order'], 404);
        }

        $validated = $request->validate([
            'quantity_ordered' => 'sometimes|numeric|min:0.01',
            'unit_price' => 'sometimes|numeric|min:0',
            'discount_percent' => 'nullable|numeric|min:0|max:100',
            'discount_amount' => 'nullable|numeric|min:0',
            'tax_rate' => 'nullable|numeric|min:0|max:100',
            'notes' => 'nullable|string',
            'status' => 'sometimes|in:pending,allocated,fulfilled,shipped,delivered,cancelled,returned',
        ]);

        // Check batch quantity if updating
        if (isset($validated['quantity_ordered']) && $item->batch_id) {
            $batch = $item->batch;
            $additionalNeeded = $validated['quantity_ordered'] - $item->quantity_ordered;
            
            if ($additionalNeeded > 0 && $batch->current_units < $additionalNeeded) {
                return response()->json([
                    'error' => 'Insufficient quantity',
                    'message' => "Batch has only {$batch->current_units} additional units available."
                ], 422);
            }
        }

        try {
            DB::beginTransaction();

            $item->fill($validated);
            $item->calculateTotal();
            $item->save();

            $order->recalculateFromItems();

            DB::commit();

            return response()->json([
                'message' => 'Item updated successfully',
                'item' => $item->load(['batch', 'sku']),
                'order' => $order->fresh()
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Error updating order item', ['error' => $e->getMessage()]);
            return response()->json(['error' => 'Failed to update item', 'message' => $e->getMessage()], 500);
        }
    }

    /**
     * Remove item from order
     */
    public function destroy(CrmOrder $order, CrmOrderItem $item)
    {
        if ($item->order_id !== $order->id) {
            return response()->json(['error' => 'Item does not belong to this order'], 404);
        }

        if ($item->quantity_shipped > 0) {
            return response()->json([
                'error' => 'Cannot delete',
                'message' => 'This item has already been partially shipped.'
            ], 422);
        }

        try {
            DB::beginTransaction();

            $item->delete();
            $order->recalculateFromItems();

            DB::commit();

            return response()->json([
                'message' => 'Item removed from order',
                'order' => $order->fresh()
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Error removing order item', ['error' => $e->getMessage()]);
            return response()->json(['error' => 'Failed to remove item', 'message' => $e->getMessage()], 500);
        }
    }

    /**
     * Fulfill order items (allocate inventory)
     */
    public function fulfill(Request $request, CrmOrder $order)
    {
        $validated = $request->validate([
            'items' => 'required|array',
            'items.*.id' => 'required|exists:crm_order_items,id',
            'items.*.quantity_to_fulfill' => 'required|numeric|min:0',
        ]);

        try {
            DB::beginTransaction();

            foreach ($validated['items'] as $itemData) {
                $item = CrmOrderItem::find($itemData['id']);
                
                if ($item->order_id !== $order->id) {
                    continue;
                }

                $quantityToFulfill = min(
                    $itemData['quantity_to_fulfill'],
                    $item->quantity_remaining
                );

                if ($quantityToFulfill > 0 && $item->batch_id) {
                    $batch = $item->batch;
                    
                    // Validate batch
                    $errors = $item->validateBatch();
                    if (!empty($errors)) {
                        throw new \Exception(implode(' ', $errors));
                    }

                    // Deduct from batch inventory
                    $batch->current_units -= $quantityToFulfill;
                    $batch->save();

                    // Create traceability event
                    TraceabilityEvent::create([
                        'batch_id' => $batch->id,
                        'event_type' => 'order_fulfillment',
                        'description' => "📦 Fulfilled {$quantityToFulfill} {$item->unit} for Order #{$order->id}",
                        'quantity' => -$quantityToFulfill,
                        'unit' => $item->unit,
                        'facility_id' => $batch->facility_id,
                        'user_id' => auth()->id(),
                        'tenant_id' => $order->tenant_id,
                    ]);

                    // Update batch status if depleted
                    if ($batch->current_units <= 0) {
                        $batch->status = 'sold';
                        $batch->save();
                    }
                }

                $item->quantity_fulfilled += $quantityToFulfill;
                $item->status = $item->is_fully_fulfilled ? 'fulfilled' : 'allocated';
                $item->save();
            }

            // Update order status
            $allFulfilled = $order->items()->where('status', '!=', 'fulfilled')->count() === 0;
            if ($allFulfilled) {
                $order->shipping_status = 'processing';
                $order->save();
            }

            DB::commit();

            return response()->json([
                'message' => 'Items fulfilled successfully',
                'order' => $order->fresh()->load('items')
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Error fulfilling order', ['error' => $e->getMessage()]);
            return response()->json(['error' => 'Failed to fulfill items', 'message' => $e->getMessage()], 500);
        }
    }

    /**
     * Get available batches for adding to order
     */
    public function availableBatches(Request $request)
    {
        $facilityId = $request->query('facility_id');
        
        $batches = Batch::query()
            ->where('is_recalled', false)
            ->where('is_archived', false)
            ->whereNotIn('status', ['destroyed', 'sold', 'quarantine'])
            ->where('current_units', '>', 0)
            ->when($facilityId, fn($q) => $q->where('facility_id', $facilityId))
            ->with('cultivationArea')
            ->orderBy('name')
            ->get();

        return response()->json($batches);
    }
}

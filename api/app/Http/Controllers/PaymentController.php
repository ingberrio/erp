<?php

namespace App\Http\Controllers;

use App\Models\Payment;
use App\Models\CrmOrder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class PaymentController extends Controller
{
    /**
     * List payments
     */
    public function index(Request $request)
    {
        $query = Payment::with(['order.account', 'account']);

        if ($request->has('order_id')) {
            $query->where('order_id', $request->order_id);
        }

        if ($request->has('account_id')) {
            $query->where('account_id', $request->account_id);
        }

        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        if ($request->has('payment_method')) {
            $query->where('payment_method', $request->payment_method);
        }

        if ($request->has('from_date')) {
            $query->whereDate('payment_date', '>=', $request->from_date);
        }

        if ($request->has('to_date')) {
            $query->whereDate('payment_date', '<=', $request->to_date);
        }

        $payments = $query->orderBy('payment_date', 'desc')->paginate(20);

        return response()->json($payments);
    }

    /**
     * Get single payment
     */
    public function show(Payment $payment)
    {
        return response()->json(
            $payment->load(['order.account', 'account', 'refundOf', 'refunds', 'recorder'])
        );
    }

    /**
     * Record a new payment
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'order_id' => 'required|exists:crm_orders,id',
            'account_id' => 'nullable|exists:crm_accounts,id',
            'payment_method' => 'required|in:bank_transfer,wire_transfer,cheque,credit_card,debit,eft,cash,credit_note,other',
            'amount' => 'required|numeric|min:0.01',
            'currency' => 'nullable|string|max:3',
            'payment_date' => 'nullable|date',
            'reference_number' => 'nullable|string|max:100',
            'cheque_number' => 'nullable|string|max:50',
            'bank_name' => 'nullable|string|max:100',
            'transaction_id' => 'nullable|string|max:255',
            'payment_notes' => 'nullable|string',
            'internal_notes' => 'nullable|string',
        ]);

        $order = CrmOrder::find($validated['order_id']);

        try {
            DB::beginTransaction();

            $payment = new Payment($validated);
            $payment->tenant_id = $order->tenant_id;
            $payment->recorded_by = auth()->id();
            $payment->payment_date = $validated['payment_date'] ?? now();
            
            // Set account from order if not provided
            if (empty($validated['account_id'])) {
                $payment->account_id = $order->account_id;
            }

            $payment->save();

            // Update order payment status
            $this->updateOrderPaymentStatus($order);

            DB::commit();

            return response()->json([
                'message' => 'Payment recorded successfully',
                'payment' => $payment->load(['order', 'account'])
            ], 201);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Error recording payment', ['error' => $e->getMessage()]);
            return response()->json(['error' => 'Failed to record payment', 'message' => $e->getMessage()], 500);
        }
    }

    /**
     * Update payment
     */
    public function update(Request $request, Payment $payment)
    {
        if ($payment->status === 'completed') {
            return response()->json([
                'error' => 'Cannot update',
                'message' => 'Completed payments cannot be modified. Create a refund instead.'
            ], 422);
        }

        $validated = $request->validate([
            'payment_method' => 'nullable|in:bank_transfer,wire_transfer,cheque,credit_card,debit,eft,cash,credit_note,other',
            'amount' => 'nullable|numeric|min:0.01',
            'payment_date' => 'nullable|date',
            'reference_number' => 'nullable|string|max:100',
            'cheque_number' => 'nullable|string|max:50',
            'bank_name' => 'nullable|string|max:100',
            'transaction_id' => 'nullable|string|max:255',
            'payment_notes' => 'nullable|string',
            'internal_notes' => 'nullable|string',
        ]);

        try {
            $payment->update($validated);

            $this->updateOrderPaymentStatus($payment->order);

            return response()->json([
                'message' => 'Payment updated successfully',
                'payment' => $payment->fresh()->load(['order', 'account'])
            ]);

        } catch (\Exception $e) {
            Log::error('Error updating payment', ['error' => $e->getMessage()]);
            return response()->json(['error' => 'Failed to update payment', 'message' => $e->getMessage()], 500);
        }
    }

    /**
     * Mark payment as completed
     */
    public function complete(Payment $payment)
    {
        if ($payment->status === 'completed') {
            return response()->json([
                'error' => 'Already completed',
                'message' => 'This payment is already marked as completed.'
            ], 422);
        }

        try {
            $payment->markAsCompleted();
            $this->updateOrderPaymentStatus($payment->order);

            return response()->json([
                'message' => 'Payment marked as completed',
                'payment' => $payment->fresh()->load(['order', 'account'])
            ]);

        } catch (\Exception $e) {
            Log::error('Error completing payment', ['error' => $e->getMessage()]);
            return response()->json(['error' => 'Failed to complete payment', 'message' => $e->getMessage()], 500);
        }
    }

    /**
     * Cancel payment
     */
    public function cancel(Request $request, Payment $payment)
    {
        if ($payment->status === 'cancelled') {
            return response()->json([
                'error' => 'Already cancelled',
                'message' => 'This payment is already cancelled.'
            ], 422);
        }

        if ($payment->status === 'refunded') {
            return response()->json([
                'error' => 'Cannot cancel',
                'message' => 'Refunded payments cannot be cancelled.'
            ], 422);
        }

        $validated = $request->validate([
            'cancellation_reason' => 'nullable|string',
        ]);

        try {
            $payment->status = 'cancelled';
            $payment->internal_notes = ($payment->internal_notes ?? '') . "\n[CANCELLED] " . ($validated['cancellation_reason'] ?? '');
            $payment->save();

            $this->updateOrderPaymentStatus($payment->order);

            return response()->json([
                'message' => 'Payment cancelled',
                'payment' => $payment->fresh()->load(['order', 'account'])
            ]);

        } catch (\Exception $e) {
            Log::error('Error cancelling payment', ['error' => $e->getMessage()]);
            return response()->json(['error' => 'Failed to cancel payment', 'message' => $e->getMessage()], 500);
        }
    }

    /**
     * Create a refund for a payment
     */
    public function refund(Request $request, Payment $payment)
    {
        if (!$payment->canBeRefunded()) {
            return response()->json([
                'error' => 'Cannot refund',
                'message' => 'This payment cannot be refunded. It must be completed and not already fully refunded.'
            ], 422);
        }

        $validated = $request->validate([
            'amount' => 'required|numeric|min:0.01',
            'refund_reason' => 'required|string',
            'reference_number' => 'nullable|string|max:100',
        ]);

        $maxRefundable = $payment->amount - ($payment->refunded_amount ?? 0);
        if ($validated['amount'] > $maxRefundable) {
            return response()->json([
                'error' => 'Invalid amount',
                'message' => "Maximum refundable amount is \${$maxRefundable}"
            ], 422);
        }

        try {
            DB::beginTransaction();

            $refund = new Payment([
                'tenant_id' => $payment->tenant_id,
                'order_id' => $payment->order_id,
                'account_id' => $payment->account_id,
                'payment_method' => $payment->payment_method,
                'status' => 'completed',
                'amount' => -$validated['amount'],
                'currency' => $payment->currency,
                'payment_date' => now(),
                'reference_number' => $validated['reference_number'],
                'refund_of_id' => $payment->id,
                'refund_reason' => $validated['refund_reason'],
                'recorded_by' => auth()->id(),
                'payment_notes' => "Refund for payment #{$payment->payment_number}: {$validated['refund_reason']}",
            ]);
            $refund->save();

            // Update original payment
            $payment->refunded_amount = ($payment->refunded_amount ?? 0) + $validated['amount'];
            if ($payment->refunded_amount >= $payment->amount) {
                $payment->status = 'refunded';
            } else {
                $payment->status = 'partially_refunded';
            }
            $payment->save();

            $this->updateOrderPaymentStatus($payment->order);

            DB::commit();

            return response()->json([
                'message' => 'Refund processed successfully',
                'refund' => $refund->load(['order', 'account', 'refundOf']),
                'original_payment' => $payment->fresh()
            ], 201);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Error processing refund', ['error' => $e->getMessage()]);
            return response()->json(['error' => 'Failed to process refund', 'message' => $e->getMessage()], 500);
        }
    }

    /**
     * Delete pending payment
     */
    public function destroy(Payment $payment)
    {
        if ($payment->status !== 'pending') {
            return response()->json([
                'error' => 'Cannot delete',
                'message' => 'Only pending payments can be deleted.'
            ], 422);
        }

        try {
            $order = $payment->order;
            $payment->delete();
            $this->updateOrderPaymentStatus($order);

            return response()->json(['message' => 'Payment deleted successfully']);

        } catch (\Exception $e) {
            Log::error('Error deleting payment', ['error' => $e->getMessage()]);
            return response()->json(['error' => 'Failed to delete payment', 'message' => $e->getMessage()], 500);
        }
    }

    /**
     * Get payment methods and statuses
     */
    public function methods()
    {
        return response()->json([
            'methods' => Payment::PAYMENT_METHODS,
            'statuses' => Payment::STATUSES,
        ]);
    }

    /**
     * Get payment summary for order
     */
    public function orderSummary(CrmOrder $order)
    {
        $payments = $order->payments()->where('status', '!=', 'cancelled')->get();
        
        $totalPaid = $payments->where('amount', '>', 0)->sum('amount');
        $totalRefunds = abs($payments->where('amount', '<', 0)->sum('amount'));
        $netPaid = $totalPaid - $totalRefunds;
        $balance = $order->grand_total - $netPaid;

        return response()->json([
            'order_total' => $order->grand_total,
            'total_paid' => $totalPaid,
            'total_refunds' => $totalRefunds,
            'net_paid' => $netPaid,
            'balance_due' => $balance,
            'is_fully_paid' => $balance <= 0,
            'payment_status' => $order->payment_status,
            'payments' => $payments->load(['recorder']),
        ]);
    }

    /**
     * Update order payment status based on payments
     */
    private function updateOrderPaymentStatus(CrmOrder $order)
    {
        $totalPaid = $order->total_paid;
        $orderTotal = $order->grand_total;

        if ($totalPaid <= 0) {
            $order->payment_status = 'unpaid';
        } elseif ($totalPaid >= $orderTotal) {
            $order->payment_status = 'paid';
            
            // Check if order is delivered to mark as completed
            if ($order->shipping_status === 'delivered') {
                $order->order_status = 'completed';
            }
        } else {
            $order->payment_status = 'partial';
        }

        $order->save();
    }
}

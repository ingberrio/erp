<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Carbon\Carbon; // Import Carbon for date manipulation

class RegulatoryReportController extends Controller
{
    /**
     * Generates a Health Canada CTLS regulatory report based on the specified type and filters.
     *
     * @param Request $request The incoming HTTP request with report parameters.
     * @return StreamedResponse A streamed CSV file response.
     */
    public function generateCtls(Request $request)
    {
        // Validate incoming request parameters
        $request->validate([
            'reportType'  => 'required|string|in:monthly_inventory,production,disposition',
            'facilityId'  => 'required|exists:facilities,id',
            'startDate'   => 'required|date',
            'endDate'     => 'required|date|after_or_equal:startDate',
        ]);

        $reportType = $request->reportType;
        $facilityId = $request->facilityId;
        // Parse dates using Carbon for easier manipulation, especially for end of day/month
        $startDate  = Carbon::parse($request->startDate)->startOfDay();
        $endDate    = Carbon::parse($request->endDate)->endOfDay(); // Ensure end date includes the full day

        // Initialize data and headers based on report type
        $data = collect(); // Use a Laravel Collection for easier manipulation
        $headers = [];
        $filename = "health_canada_{$reportType}_report_" . Carbon::now()->format('Ymd_His') . ".csv";

        switch ($reportType) {
            case 'monthly_inventory':
                // For Monthly Inventory Report, we typically need the inventory at the END of the period.
                // This simplified example fetches batches that were created within the date range
                // and assumes their 'units' represent their current quantity.
                // For a true inventory report, you'd need a more robust inventory tracking system
                // that updates current quantities or calculates them based on all events up to endDate.

                $batches = DB::table('batches')
                    ->where('facility_id', $facilityId)
                    // Consider if you need to filter by creation date or if you need all active batches
                    // For a snapshot, you might need batches that were active at endDate.
                    // For simplicity, we'll still use created_at for now, but be aware of this limitation.
                    // ->whereBetween('created_at', [$startDate, $endDate]) // This might not be suitable for actual inventory snapshot
                    ->where(function ($query) use ($endDate) {
                        // This attempts to get batches that existed and were active up to the end date.
                        // A more precise inventory would require tracking quantity changes via events.
                        $query->where('created_at', '<=', $endDate);
                        // And if you have a 'disposed_at' or 'destroyed_at' column:
                        // $query->where(function ($q) {
                        //     $q->whereNull('disposed_at')->orWhere('disposed_at', '>', $endDate);
                        // });
                    })
                    ->select(
                        'id',
                        'name', // Or a unique product identifier
                        'units', // Assuming this is the current quantity
                        'product_type',
                        'variety',
                        'created_at',
                        'cultivation_area_id' // <-- CORRECTED: Changed to 'cultivation_area_id'
                    )
                    ->get();

                $headers = [
                    'Inventory ID (Batch ID)',
                    'Product Name/Identifier',
                    'Product Type (HC Category)', // e.g., Dried Cannabis, Cannabis Oil
                    'Variety/Strain',
                    'Quantity',
                    'Unit of Measure', // e.g., G (grams), KG (kilograms), EA (each for plants/seeds)
                    'Packaged Status (Packaged/Unpackaged)', // If tracked
                    'Location (Cultivation Area ID/Name)', // Current location
                    'Report Date', // The endDate of the selected period
                    // Add all other required columns for Monthly Inventory Report as per CTLS
                    // Example: Date of Last Activity, Unique Identifier for Plants/Packages
                ];

                $data = $batches->map(function ($batch) use ($endDate) {
                    // Fetch cultivation area name for location
                    $cultivationAreaName = null;
                    if ($batch->cultivation_area_id) { // <-- CORRECTED: Changed to 'cultivation_area_id'
                        $area = DB::table('cultivation_areas')->where('id', $batch->cultivation_area_id)->first(); // <-- CORRECTED: Changed to 'cultivation_area_id'
                        $cultivationAreaName = $area ? $area->name : 'Unknown Area';
                    }

                    return [
                        $batch->id,
                        $batch->name,
                        $batch->product_type,
                        $batch->variety,
                        $batch->units,
                        'g', // Placeholder: This needs to be dynamic based on actual units for product_type
                        'Unpackaged', // Placeholder: Needs actual logic to determine packaged status
                        $cultivationAreaName,
                        $endDate->format('Y-m-d'), // The end date of the report period
                    ];
                });
                break;

            case 'production':
                // This would typically involve traceability events like 'harvest' and 'processing'.
                $data = DB::table('traceability_events')
                    ->where('facility_id', $facilityId)
                    ->whereIn('event_type', ['harvest', 'processing']) // Filter for relevant event types
                    ->whereBetween('created_at', [$startDate, $endDate])
                    ->select('id', 'event_type', 'batch_id', 'quantity', 'unit', 'description', 'created_at')
                    ->get();

                $headers = [
                    'Event ID',
                    'Event Type',
                    'Batch ID',
                    'Quantity Produced',
                    'Unit of Measure',
                    'Event Date',
                    'Description',
                    // Add all other required columns for Production Report as per CTLS
                ];

                 $data = $data->map(function ($row) {
                    return [
                        $row->id,
                        $row->event_type,
                        $row->batch_id,
                        $row->quantity,
                        $row->unit,
                        $row->created_at,
                        $row->description,
                    ];
                });
                break;

            case 'disposition':
                // This would involve events like 'movement' (for sales/transfers), 'destruction', 'loss_theft'.
                $data = DB::table('traceability_events')
                    ->where('facility_id', $facilityId)
                    ->whereIn('event_type', ['movement', 'destruction', 'loss_theft']) // Filter for relevant event types
                    ->whereBetween('created_at', [$startDate, $endDate])
                    ->select('id', 'event_type', 'batch_id', 'quantity', 'unit', 'description', 'created_at')
                    ->get();

                $headers = [
                    'Event ID',
                    'Event Type',
                    'Batch ID',
                    'Quantity Disposed',
                    'Unit of Measure',
                    'Event Date',
                    'Description',
                    // Add all other required columns for Disposition Report as per CTLS
                ];

                $data = $data->map(function ($row) {
                    return [
                        $row->id,
                        $row->event_type,
                        $row->batch_id,
                        $row->quantity,
                        $row->unit,
                        $row->created_at,
                        $row->description,
                    ];
                });
                break;

            default:
                // Handle unsupported report types (though validation should prevent this)
                return response()->json(['message' => 'Unsupported report type.'], 400);
        }

        // Generate CSV and stream the response
        $response = new StreamedResponse(function () use ($data, $headers) {
            $handle = fopen('php://output', 'w');
            fputcsv($handle, $headers); // Write headers
            foreach ($data as $row) {
                fputcsv($handle, $row); // Write data rows
            }
            fclose($handle);
        });

        // Set response headers for CSV download
        $response->headers->set('Content-Type', 'text/csv');
        $response->headers->set('Content-Disposition', 'attachment; filename="' . $filename . '"');
        $response->headers->set('Cache-Control', 'no-cache, no-store, must-revalidate');
        $response->headers->set('Pragma', 'no-cache');
        $response->headers->set('Expires', '0');

        return $response;
    }
}

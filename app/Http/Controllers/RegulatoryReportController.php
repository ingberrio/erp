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
                // and assumes their 'current_units' represent their current quantity.
                // For a true inventory report, you'd need a more robust inventory tracking system
                // that updates current quantities or calculates them based on all events up to endDate.

                $batches = DB::table('batches')
                    ->where('facility_id', $facilityId)
                    ->where(function ($query) use ($endDate) {
                        $query->where('created_at', '<=', $endDate);
                    })
                    ->select(
                        'id',
                        'name',
                        'current_units',
                        'product_type',
                        'variety',
                        'created_at',
                        'cultivation_area_id',
                        'is_packaged' // <-- NEW: Select the is_packaged column
                    )
                    ->get();

                $headers = [
                    'Inventory ID (Batch ID)',
                    'Product Name/Identifier',
                    'Product Type (HC Category)',
                    'Variety/Strain',
                    'Quantity',
                    'Unit of Measure',
                    'Packaged Status (Packaged/Unpackaged)', // Now dynamic
                    'Location (Cultivation Area ID/Name)',
                    'Report Date',
                ];

                $data = $batches->map(function ($batch) use ($endDate) {
                    // Fetch cultivation area name for location
                    $cultivationAreaName = null;
                    if ($batch->cultivation_area_id) {
                        $area = DB::table('cultivation_areas')->where('id', $batch->cultivation_area_id)->first();
                        $cultivationAreaName = $area ? $area->name : 'Unknown Area';
                    }

                    // Determine packaged status string
                    $packagedStatus = $batch->is_packaged ? 'Packaged' : 'Unpackaged'; // <-- NEW: Use the column value

                    return [
                        $batch->id,
                        $batch->name,
                        $batch->product_type,
                        $batch->variety,
                        $batch->current_units,
                        'g', // Placeholder: This needs to be dynamic based on actual units for product_type
                        $packagedStatus, // <-- NEW: Use the dynamic status
                        $cultivationAreaName,
                        $endDate->format('Y-m-d'),
                    ];
                });
                break;

            case 'production':
                $data = DB::table('traceability_events')
                    ->where('facility_id', $facilityId)
                    ->whereIn('event_type', ['harvest', 'processing'])
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
                $data = DB::table('traceability_events')
                    ->where('facility_id', $facilityId)
                    ->whereIn('event_type', ['movement', 'destruction', 'loss_theft'])
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

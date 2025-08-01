<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Carbon\Carbon;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;

// Importar los modelos necesarios para usar Eloquent
use App\Models\Batch;
use App\Models\TraceabilityEvent;
use App\Models\CultivationArea;
use App\Models\Facility;
use App\Models\User;

class RegulatoryReportController extends Controller
{
    /**
     * Mapea los tipos de producto internos a códigos de Health Canada (ejemplos).
     * En un entorno real, esto se basaría en la documentación oficial de HC.
     * Estos son los tipos de producto que esperas ver en los encabezados del reporte CTLS.
     *
     * @param string|null $productType
     * @return string
     */
    private function mapProductTypeToHCCode(?string $productType): string
    {
        if ($productType === null) {
            return 'Other'; // O un código específico para "desconocido" si CTLS lo tiene
        }

        return match ($productType) {
            'Vegetative cannabis plants' => 'Vegetative cannabis plants',
            'Fresh cannabis' => 'Fresh cannabis',
            'Dried cannabis' => 'Dried cannabis',
            'Seeds' => 'Seeds',
            'Pure Intermediates' => 'Pure Intermediates',
            'Edibles - Solids' => 'Edibles - Solids',
            'Edibles - Non-solids' => 'Edibles - Non-solids',
            'Extracts - Inhaled' => 'Extracts - Inhaled',
            'Extracts - Ingested' => 'Extracts - Ingested',
            'Extracts - Other' => 'Extracts - Other',
            'Topicals' => 'Topicals',
            'Other' => 'Other',
            default => 'Other', // Default para tipos no reconocidos
        };
    }

    /**
     * Mapea las unidades de medida internas a códigos de Health Canada (ejemplos).
     * En un entorno real, esto se basaría en la documentación oficial de HC.
     *
     * @param string|null $unit
     * @return string
     */
    private function mapUnitToHCCode(?string $unit): string
    {
        if ($unit === null) {
            return 'kg'; // Un valor por defecto razonable si la unidad es desconocida
        }

        return match (strtolower($unit)) {
            'g' => 'kg', // CTLS a menudo requiere kg para masa
            'kg' => 'kg',
            'units' => '#', // Para semillas/plantas
            'ml' => 'L', // CTLS a menudo requiere L para volumen
            'l' => 'L',
            default => 'kg', // Default
        };
    }

    /**
     * Mapea los tipos de evento internos a códigos de Health Canada (ejemplos).
     * En un entorno real, esto se basaría en la documentación oficial de HC.
     *
     * @param string|null $eventType
     * @return string
     */
    private function mapEventTypeToHCCode(?string $eventType): string
    {
        if ($eventType === null) {
            return 'Unknown Event';
        }

        return match (strtolower($eventType)) {
            'movement' => 'Movement',
            'cultivation' => 'Cultivation Activity',
            'harvest' => 'Harvest',
            'sampling' => 'Sampling',
            'destruction' => 'Destruction',
            'loss_theft' => 'Loss/Theft',
            'processing' => 'Processing',
            default => 'Unknown Event',
        };
    }

    /**
     * Generates a Health Canada CTLS regulatory report based on the specified type and filters.
     *
     * @param Request $request The incoming HTTP request with report parameters.
     * @return StreamedResponse|\Illuminate\Http\JsonResponse A streamed CSV file response or JSON error.
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
        $startDate  = Carbon::parse($request->startDate)->startOfDay();
        $endDate    = Carbon::parse($request->endDate)->endOfDay();

        // Obtener el tenant_id y licence_number de la instalación seleccionada
        $facility = Facility::find($facilityId);
        if (!$facility) {
            Log::error('RegulatoryReportController@generateCtls: Facility not found for ID: ' . $facilityId);
            return response()->json(['message' => 'Selected facility not found.'], 404);
        }
        $tenantId = $facility->tenant_id;
        $licenceNumber = $facility->licence_number ?? 'N/A'; // Asume que la tabla facilities tiene licence_number

        if (!$tenantId) {
            Log::error('RegulatoryReportController@generateCtls: Tenant ID is missing for selected facility: ' . $facilityId);
            return response()->json(['message' => 'Selected facility does not have an associated Tenant ID.'], 400);
        }

        // Verificación de autorización: Asegurarse de que el usuario tiene permiso para este tenant/instalación
        if (Auth::check() && !Auth::user()->is_global_admin && Auth::user()->tenant_id !== $tenantId) {
            Log::warning('RegulatoryReportController@generateCtls: Unauthorized attempt to generate report for another tenant.', [
                'user_id' => Auth::id(),
                'user_tenant_id' => Auth::user()->tenant_id,
                'requested_tenant_id' => $tenantId,
                'facility_id' => $facilityId
            ]);
            return response()->json(['message' => 'You are not authorized to generate reports for this facility.'], 403);
        }

        $data = collect();
        $headers = [];
        $filename = "CTLS_{$reportType}_report_" . Carbon::now()->format('Ymd_His') . ".csv";

        // Common report metadata
        $reportingPeriodYear = $endDate->year;
        $reportingPeriodMonth = $endDate->month;
        $siteId = $facility->id; // Using facility ID as Site ID

        switch ($reportType) {
            case 'monthly_inventory':
                // Definir las categorías de inventario y sus unidades esperadas por CTLS
                // Estas deben coincidir EXACTAMENTE con las columnas del archivo de ejemplo
                $inventoryCategories = [
                    'Unpackaged - Seeds' => ['unit' => '#', 'product_type' => 'Seeds', 'is_packaged' => false],
                    'Unpackaged - Vegetative cannabis plants' => ['unit' => '#', 'product_type' => 'Vegetative cannabis plants', 'is_packaged' => false],
                    'Unpackaged - Fresh cannabis' => ['unit' => 'kg', 'product_type' => 'Fresh cannabis', 'is_packaged' => false],
                    'Unpackaged - Dried cannabis' => ['unit' => 'kg', 'product_type' => 'Dried cannabis', 'is_packaged' => false],
                    'Unpackaged - Pure Intermediates' => ['unit' => 'kg', 'product_type' => 'Pure Intermediates', 'is_packaged' => false],
                    'Unpackaged - Edibles - Solids' => ['unit' => 'kg', 'product_type' => 'Edibles - Solids', 'is_packaged' => false],
                    'Unpackaged - Edibles - Non-solids' => ['unit' => 'kg', 'product_type' => 'Edibles - Non-solids', 'is_packaged' => false],
                    'Unpackaged - Extracts - Inhaled' => ['unit' => 'kg', 'product_type' => 'Extracts - Inhaled', 'is_packaged' => false],
                    'Unpackaged - Extracts - Ingested' => ['unit' => 'kg', 'product_type' => 'Extracts - Ingested', 'is_packaged' => false],
                    'Unpackaged - Extracts - Other' => ['unit' => 'kg', 'product_type' => 'Extracts - Other', 'is_packaged' => false],
                    'Unpackaged - Topicals' => ['unit' => 'kg', 'product_type' => 'Topicals', 'is_packaged' => false],
                    'Unpackaged - Other' => ['unit' => 'kg', 'product_type' => 'Other', 'is_packaged' => false],

                    'Packaged - Seeds' => ['unit' => '#', 'product_type' => 'Seeds', 'is_packaged' => true],
                    'Packaged - Vegetative cannabis plants' => ['unit' => '#', 'product_type' => 'Vegetative cannabis plants', 'is_packaged' => true],
                    'Packaged - Fresh cannabis' => ['unit' => 'kg', 'product_type' => 'Fresh cannabis', 'is_packaged' => true],
                    'Packaged - Dried cannabis' => ['unit' => 'kg', 'product_type' => 'Dried cannabis', 'is_packaged' => true],
                    'Packaged - Pure Intermediates' => ['unit' => 'kg', 'product_type' => 'Pure Intermediates', 'is_packaged' => true],
                    'Packaged - Edibles - Solids' => ['unit' => 'kg', 'product_type' => 'Edibles - Solids', 'is_packaged' => true],
                    'Packaged - Edibles - Non-solids' => ['unit' => 'kg', 'product_type' => 'Edibles - Non-solids', 'is_packaged' => true],
                    'Packaged - Extracts - Inhaled' => ['unit' => 'kg', 'product_type' => 'Extracts - Inhaled', 'is_packaged' => true],
                    'Packaged - Extracts - Ingested' => ['unit' => 'kg', 'product_type' => 'Extracts - Ingested', 'is_packaged' => true],
                    'Packaged - Extracts - Other' => ['unit' => 'kg', 'product_type' => 'Extracts - Other', 'is_packaged' => true],
                    'Packaged - Topicals' => ['unit' => 'kg', 'product_type' => 'Topicals', 'is_packaged' => true],
                    'Packaged - Other' => ['unit' => 'kg', 'product_type' => 'Other', 'is_packaged' => true],
                ];

                // Headers de columna EXACTOS del archivo de ejemplo
                $headers = [
                    'Reporting Period Year (####)',
                    'Reporting Period Month (##)',
                    'Licence ID',
                    'Unpackaged - Seeds - Opening inventory (#)',
                    'Unpackaged - Seeds - Additions - Produced (#)',
                    'Unpackaged - Seeds - Additions - Received - domestic (#)',
                    'Unpackaged - Seeds - Additions - Received - imported (#)',
                    'Unpackaged - Seeds - Additions - Received - returned (#)',
                    'Unpackaged - Seeds - Additions - Other (#)',
                    'Unpackaged - Seeds - Reductions - Processed (#)',
                    'Unpackaged - Seeds - Reductions - Packaged and labeled (#)',
                    'Unpackaged - Seeds - Reductions - Shipped - domestic - to analytical testers (#)',
                    'Unpackaged - Seeds - Reductions - Shipped - domestic - to researchers (#)',
                    'Unpackaged - Seeds - Reductions - Shipped - domestic - To cultivators and processors (#)',
                    'Unpackaged - Seeds - Reductions - Shipped - exported (#)',
                    'Unpackaged - Seeds - Reductions - Shipped - exported value ($)',
                    'Unpackaged - Seeds - Reductions - Shipped - returned (#)',
                    'Unpackaged - Seeds - Reductions - Destroyed (#)',
                    'Unpackaged - Seeds - Reductions - Lost/stolen (#)',
                    'Unpackaged - Seeds - Reductions - Other (#)',
                    'Unpackaged - Seeds - Closing inventory (#)',
                    'Unpackaged - Seeds - Closing inventory value ($)',
                    'Unpackaged - Vegetative cannabis plants - Opening inventory (#)',
                    'Unpackaged - Vegetative cannabis plants - Additions - Produced (#)',
                    'Unpackaged - Vegetative cannabis plants - Additions - Received - domestic (#)',
                    'Unpackaged - Vegetative cannabis plants - Additions - Received - imported (#)',
                    'Unpackaged - Vegetative cannabis plants - Additions - Received - returned (#)',
                    'Unpackaged - Vegetative cannabis plants - Additions - Other (#)',
                    'Unpackaged - Vegetative cannabis plants - Reductions - Processed (#)',
                    'Unpackaged - Vegetative cannabis plants - Reductions - Packaged and labeled (#)',
                    'Unpackaged - Vegetative cannabis plants - Reductions - Shipped - domestic - to analytical testers (#)',
                    'Unpackaged - Vegetative cannabis plants - Reductions - Shipped - domestic - to researchers (#)',
                    'Unpackaged - Vegetative cannabis plants - Reductions - Shipped - domestic - To cultivators and processors (#)',
                    'Unpackaged - Vegetative cannabis plants - Reductions - Shipped - exported (#)',
                    'Unpackaged - Vegetative cannabis plants - Reductions - Shipped - exported value ($)',
                    'Unpackaged - Vegetative cannabis plants - Reductions - Shipped - returned (#)',
                    'Unpackaged - Vegetative cannabis plants - Reductions - Destroyed (#)',
                    'Unpackaged - Vegetative cannabis plants - Reductions - Lost/stolen (#)',
                    'Unpackaged - Vegetative cannabis plants - Reductions - Other (#)',
                    'Unpackaged - Vegetative cannabis plants - Closing inventory (#)',
                    'Unpackaged - Vegetative cannabis plants - Closing inventory value ($)',
                    'Unpackaged - Fresh cannabis - Opening inventory (kg)',
                    'Unpackaged - Fresh cannabis - Additions - Produced (kg)',
                    'Unpackaged - Fresh cannabis - Additions - Received - domestic (kg)',
                    'Unpackaged - Fresh cannabis - Additions - Received - imported (kg)',
                    'Unpackaged - Fresh cannabis - Additions - Received - returned (kg)',
                    'Unpackaged - Fresh cannabis - Additions - Other (kg)',
                    'Unpackaged - Fresh cannabis - Reductions - Processed (kg)',
                    'Unpackaged - Fresh cannabis - Reductions - Packaged and labeled (kg)',
                    'Unpackaged - Fresh cannabis - Reductions - Shipped - domestic - to analytical testers (kg)',
                    'Unpackaged - Fresh cannabis - Reductions - Shipped - domestic - to researchers (kg)',
                    'Unpackaged - Fresh cannabis - Reductions - Shipped - domestic - To cultivators and processors (kg)',
                    'Unpackaged - Fresh cannabis - Reductions - Shipped - exported (kg)',
                    'Unpackaged - Fresh cannabis - Reductions - Shipped - exported value ($)',
                    'Unpackaged - Fresh cannabis - Reductions - Shipped - returned (kg)',
                    'Unpackaged - Fresh cannabis - Reductions - Destroyed (kg)',
                    'Unpackaged - Fresh cannabis - Reductions - Lost/stolen (kg)',
                    'Unpackaged - Fresh cannabis - Reductions - Other (kg)',
                    'Unpackaged - Fresh cannabis - Closing inventory (kg)',
                    'Unpackaged - Fresh cannabis - Closing inventory value ($)',
                    'Unpackaged - Dried cannabis - Opening inventory (kg)',
                    'Unpackaged - Dried cannabis - Additions - Produced (kg)',
                    'Unpackaged - Dried cannabis - Additions - Received - domestic (kg)',
                    'Unpackaged - Dried cannabis - Additions - Received - imported (kg)',
                    'Unpackaged - Dried cannabis - Additions - Received - returned (kg)',
                    'Unpackaged - Dried cannabis - Additions - Other (kg)',
                    'Unpackaged - Dried cannabis - Reductions - Processed (kg)',
                    'Unpackaged - Dried cannabis - Reductions - Packaged and labeled (kg)',
                    'Unpackaged - Dried cannabis - Reductions - Shipped - domestic - to analytical testers (kg)',
                    'Unpackaged - Dried cannabis - Reductions - Shipped - domestic - to researchers (kg)',
                    'Unpackaged - Dried cannabis - Reductions - Shipped - domestic - To cultivators and processors (kg)',
                    'Unpackaged - Dried cannabis - Reductions - Shipped - exported (kg)',
                    'Unpackaged - Dried cannabis - Reductions - Shipped - exported value ($)',
                    'Unpackaged - Dried cannabis - Reductions - Shipped - returned (kg)',
                    'Unpackaged - Dried cannabis - Reductions - Destroyed (kg)',
                    'Unpackaged - Dried cannabis - Reductions - Lost/stolen (kg)',
                    'Unpackaged - Dried cannabis - Reductions - Other (kg)',
                    'Unpackaged - Dried cannabis - Closing inventory (kg)',
                    'Unpackaged - Dried cannabis - Closing inventory value ($)',
                    'Unpackaged - Pure Intermediates - Opening inventory (kg)',
                    'Unpackaged - Pure Intermediates - Additions - Produced (kg)',
                    'Unpackaged - Pure Intermediates - Additions - Received - domestic (kg)',
                    'Unpackaged - Pure Intermediates - Additions - Received - imported (kg)',
                    'Unpackaged - Pure Intermediates - Additions - Received - returned (kg)',
                    'Unpackaged - Pure Intermediates - Additions - Other (kg)',
                    'Unpackaged - Pure Intermediates - Reductions - Processed (kg)',
                    'Unpackaged - Pure Intermediates - Reductions - Packaged and labeled (kg)',
                    'Unpackaged - Pure Intermediates - Reductions - Shipped - domestic - to analytical testers (kg)',
                    'Unpackaged - Pure Intermediates - Reductions - Shipped - domestic - to researchers (kg)',
                    'Unpackaged - Pure Intermediates - Reductions - Shipped - domestic - To cultivators and processors (kg)',
                    'Unpackaged - Pure Intermediates - Reductions - Shipped - exported (kg)',
                    'Unpackaged - Pure Intermediates - Reductions - Shipped - exported value ($)',
                    'Unpackaged - Pure Intermediates - Reductions - Shipped - returned (kg)',
                    'Unpackaged - Pure Intermediates - Reductions - Destroyed (kg)',
                    'Unpackaged - Pure Intermediates - Reductions - Lost/stolen (kg)',
                    'Unpackaged - Pure Intermediates - Reductions - Other (kg)',
                    'Unpackaged - Pure Intermediates - Closing inventory (kg)',
                    'Unpackaged - Pure Intermediates - Closing inventory value ($)',
                    'Unpackaged - Edibles - Solids - Opening inventory (kg)',
                    'Unpackaged - Edibles - Solids - Additions - Produced (kg)',
                    'Unpackaged - Edibles - Solids - Additions - Received - domestic (kg)',
                    'Unpackaged - Edibles - Solids - Additions - Received - imported (kg)',
                    'Unpackaged - Edibles - Solids - Additions - Received - returned (kg)',
                    'Unpackaged - Edibles - Solids - Additions - Other (kg)',
                    'Unpackaged - Edibles - Solids - Reductions - Processed (kg)',
                    'Unpackaged - Edibles - Solids - Reductions - Packaged and labeled (kg)',
                    'Unpackaged - Edibles - Solids - Reductions - Shipped - domestic - to analytical testers (kg)',
                    'Unpackaged - Edibles - Solids - Reductions - Shipped - domestic - to researchers (kg)',
                    'Unpackaged - Edibles - Solids - Reductions - Shipped - domestic - To cultivators and processors (kg)',
                    'Unpackaged - Edibles - Solids - Reductions - Shipped - exported (kg)',
                    'Unpackaged - Edibles - Solids - Reductions - Shipped - exported value ($)',
                    'Unpackaged - Edibles - Solids - Reductions - Shipped - returned (kg)',
                    'Unpackaged - Edibles - Solids - Reductions - Destroyed (kg)',
                    'Unpackaged - Edibles - Solids - Reductions - Lost/stolen (kg)',
                    'Unpackaged - Edibles - Solids - Reductions - Other (kg)',
                    'Unpackaged - Edibles - Solids - Closing inventory (kg)',
                    'Unpackaged - Edibles - Solids - Closing inventory value ($)',
                    'Unpackaged - Edibles - Non-solids - Opening inventory (kg)',
                    'Unpackaged - Edibles - Non-solids - Additions - Produced (kg)',
                    'Unpackaged - Edibles - Non-solids - Additions - Received - domestic (kg)',
                    'Unpackaged - Edibles - Non-solids - Additions - Received - imported (kg)',
                    'Unpackaged - Edibles - Non-solids - Additions - Received - returned (kg)',
                    'Unpackaged - Edibles - Non-solids - Additions - Other (kg)',
                    'Unpackaged - Edibles - Non-solids - Reductions - Processed (kg)',
                    'Unpackaged - Edibles - Non-solids - Reductions - Packaged and labeled (kg)',
                    'Unpackaged - Edibles - Non-solids - Reductions - Shipped - domestic - to analytical testers (kg)',
                    'Unpackaged - Edibles - Non-solids - Reductions - Shipped - domestic - to researchers (kg)',
                    'Unpackaged - Edibles - Non-solids - Reductions - Shipped - domestic - To cultivators and processors (kg)',
                    'Unpackaged - Edibles - Non-solids - Reductions - Shipped - exported (kg)',
                    'Unpackaged - Edibles - Non-solids - Reductions - Shipped - exported value ($)',
                    'Unpackaged - Edibles - Non-solids - Reductions - Shipped - returned (kg)',
                    'Unpackaged - Edibles - Non-solids - Reductions - Destroyed (kg)',
                    'Unpackaged - Edibles - Non-solids - Reductions - Lost/stolen (kg)',
                    'Unpackaged - Edibles - Non-solids - Reductions - Other (kg)',
                    'Unpackaged - Edibles - Non-solids - Closing inventory (kg)',
                    'Unpackaged - Edibles - Non-solids - Closing inventory value ($)',
                    'Unpackaged - Extracts - Inhaled - Opening inventory (kg)',
                    'Unpackaged - Extracts - Inhaled - Additions - Produced (kg)',
                    'Unpackaged - Extracts - Inhaled - Additions - Received - domestic (kg)',
                    'Unpackaged - Extracts - Inhaled - Additions - Received - imported (kg)',
                    'Unpackaged - Extracts - Inhaled - Additions - Received - returned (kg)',
                    'Unpackaged - Extracts - Inhaled - Additions - Other (kg)',
                    'Unpackaged - Extracts - Inhaled - Reductions - Processed (kg)',
                    'Unpackaged - Extracts - Inhaled - Reductions - Packaged and labeled (kg)',
                    'Unpackaged - Extracts - Inhaled - Reductions - Shipped - domestic - to analytical testers (kg)',
                    'Unpackaged - Extracts - Inhaled - Reductions - Shipped - domestic - to researchers (kg)',
                    'Unpackaged - Extracts - Inhaled - Reductions - Shipped - domestic - To cultivators and processors (kg)',
                    'Unpackaged - Extracts - Inhaled - Reductions - Shipped - exported (kg)',
                    'Unpackaged - Extracts - Inhaled - Reductions - Shipped - exported value ($)',
                    'Unpackaged - Extracts - Inhaled - Reductions - Shipped - returned (kg)',
                    'Unpackaged - Extracts - Inhaled - Reductions - Destroyed (kg)',
                    'Unpackaged - Extracts - Inhaled - Reductions - Lost/stolen (kg)',
                    'Unpackaged - Extracts - Inhaled - Reductions - Other (kg)',
                    'Unpackaged - Extracts - Inhaled - Closing inventory (kg)',
                    'Unpackaged - Extracts - Inhaled - Closing inventory value ($)',
                    'Unpackaged - Extracts - Ingested - Opening inventory (kg)',
                    'Unpackaged - Extracts - Ingested - Additions - Produced (kg)',
                    'Unpackaged - Extracts - Ingested - Additions - Received - domestic (kg)',
                    'Unpackaged - Extracts - Ingested - Additions - Received - imported (kg)',
                    'Unpackaged - Extracts - Ingested - Additions - Received - returned (kg)',
                    'Unpackaged - Extracts - Ingested - Additions - Other (kg)',
                    'Unpackaged - Extracts - Ingested - Reductions - Processed (kg)',
                    'Unpackaged - Extracts - Ingested - Reductions - Packaged and labeled (kg)',
                    'Unpackaged - Extracts - Ingested - Reductions - Shipped - domestic - to analytical testers (kg)',
                    'Unpackaged - Extracts - Ingested - Reductions - Shipped - domestic - to researchers (kg)',
                    'Unpackaged - Extracts - Ingested - Reductions - Shipped - domestic - To cultivators and processors (kg)',
                    'Unpackaged - Extracts - Ingested - Reductions - Shipped - exported (kg)',
                    'Unpackaged - Extracts - Ingested - Reductions - Shipped - exported value ($)',
                    'Unpackaged - Extracts - Ingested - Reductions - Shipped - returned (kg)',
                    'Unpackaged - Extracts - Ingested - Reductions - Destroyed (kg)',
                    'Unpackaged - Extracts - Ingested - Reductions - Lost/stolen (kg)',
                    'Unpackaged - Extracts - Ingested - Reductions - Other (kg)',
                    'Unpackaged - Extracts - Ingested - Closing inventory (kg)',
                    'Unpackaged - Extracts - Ingested - Closing inventory value ($)',
                    'Unpackaged - Extracts - Other - Opening inventory (kg)',
                    'Unpackaged - Extracts - Other - Additions - Produced (kg)',
                    'Unpackaged - Extracts - Other - Additions - Received - domestic (kg)',
                    'Unpackaged - Extracts - Other - Additions - Received - imported (kg)',
                    'Unpackaged - Extracts - Other - Additions - Received - returned (kg)',
                    'Unpackaged - Extracts - Other - Additions - Other (kg)',
                    'Unpackaged - Extracts - Other - Reductions - Processed (kg)',
                    'Unpackaged - Extracts - Other - Reductions - Packaged and labeled (kg)',
                    'Unpackaged - Extracts - Other - Reductions - Shipped - domestic - to analytical testers (kg)',
                    'Unpackaged - Extracts - Other - Reductions - Shipped - domestic - to researchers (kg)',
                    'Unpackaged - Extracts - Other - Reductions - Shipped - domestic - To cultivators and processors (kg)',
                    'Unpackaged - Extracts - Other - Reductions - Shipped - exported (kg)',
                    'Unpackaged - Extracts - Other - Reductions - Shipped - exported value ($)',
                    'Unpackaged - Extracts - Other - Reductions - Shipped - returned (kg)',
                    'Unpackaged - Extracts - Other - Reductions - Destroyed (kg)',
                    'Unpackaged - Extracts - Other - Reductions - Lost/stolen (kg)',
                    'Unpackaged - Extracts - Other - Reductions - Other (kg)',
                    'Unpackaged - Extracts - Other - Closing inventory (kg)',
                    'Unpackaged - Extracts - Other - Closing inventory value ($)',
                    'Unpackaged - Topicals - Opening inventory (kg)',
                    'Unpackaged - Topicals - Additions - Produced (kg)',
                    'Unpackaged - Topicals - Additions - Received - domestic (kg)',
                    'Unpackaged - Topicals - Additions - Received - imported (kg)',
                    'Unpackaged - Topicals - Additions - Received - returned (kg)',
                    'Unpackaged - Topicals - Additions - Other (kg)',
                    'Unpackaged - Topicals - Reductions - Processed (kg)',
                    'Unpackaged - Topicals - Reductions - Packaged and labeled (kg)',
                    'Unpackaged - Topicals - Reductions - Shipped - domestic - to analytical testers (kg)',
                    'Unpackaged - Topicals - Reductions - Shipped - domestic - to researchers (kg)',
                    'Unpackaged - Topicals - Reductions - Shipped - domestic - To cultivators and processors (kg)',
                    'Unpackaged - Topicals - Reductions - Shipped - exported (kg)',
                    'Unpackaged - Topicals - Reductions - Shipped - exported value ($)',
                    'Unpackaged - Topicals - Reductions - Shipped - returned (kg)',
                    'Unpackaged - Topicals - Reductions - Destroyed (kg)',
                    'Unpackaged - Topicals - Reductions - Lost/stolen (kg)',
                    'Unpackaged - Topicals - Reductions - Other (kg)',
                    'Unpackaged - Topicals - Closing inventory (kg)',
                    'Unpackaged - Topicals - Closing inventory value ($)',
                    'Unpackaged - Other - Opening inventory (kg)',
                    'Unpackaged - Other - Additions - Produced (kg)',
                    'Unpackaged - Other - Additions - Received - domestic (kg)',
                    'Unpackaged - Other - Additions - Received - imported (kg)',
                    'Unpackaged - Other - Additions - Received - returned (kg)',
                    'Unpackaged - Other - Additions - Other (kg)',
                    'Unpackaged - Other - Reductions - Processed (kg)',
                    'Unpackaged - Other - Reductions - Packaged and labeled (kg)',
                    'Unpackaged - Other - Reductions - Shipped - domestic - to analytical testers (kg)',
                    'Unpackaged - Other - Reductions - Shipped - domestic - to researchers (kg)',
                    'Unpackaged - Other - Reductions - Shipped - domestic - To cultivators and processors (kg)',
                    'Unpackaged - Other - Reductions - Shipped - exported (kg)',
                    'Unpackaged - Other - Reductions - Shipped - exported value ($)',
                    'Unpackaged - Other - Reductions - Shipped - returned (kg)',
                    'Unpackaged - Other - Reductions - Destroyed (kg)',
                    'Unpackaged - Other - Reductions - Lost/stolen (kg)',
                    'Unpackaged - Other - Reductions - Other (kg)',
                    'Unpackaged - Other - Closing inventory (kg)',
                    'Unpackaged - Other - Closing inventory value ($)',

                    'Packaged - Seeds - Opening inventory (#)',
                    'Packaged - Seeds - Additions - Produced (#)',
                    'Packaged - Seeds - Additions - Received - domestic (#)',
                    'Packaged - Seeds - Additions - Received - imported (#)',
                    'Packaged - Seeds - Additions - Received - returned (#)',
                    'Packaged - Seeds - Additions - Other (#)',
                    'Packaged - Seeds - Reductions - Processed (#)',
                    'Packaged - Seeds - Reductions - Packaged and labeled (#)',
                    'Packaged - Seeds - Reductions - Shipped - domestic - to analytical testers (#)',
                    'Packaged - Seeds - Reductions - Shipped - domestic - to researchers (#)',
                    'Packaged - Seeds - Reductions - Shipped - domestic - To cultivators and processors (#)',
                    'Packaged - Seeds - Reductions - Shipped - exported (#)',
                    'Packaged - Seeds - Reductions - Shipped - exported value ($)',
                    'Packaged - Seeds - Reductions - Shipped - returned (#)',
                    'Packaged - Seeds - Reductions - Destroyed (#)',
                    'Packaged - Seeds - Reductions - Lost/stolen (#)',
                    'Packaged - Seeds - Reductions - Other (#)',
                    'Packaged - Seeds - Closing inventory (#)',
                    'Packaged - Seeds - Closing inventory value ($)',
                    'Packaged - Vegetative cannabis plants - Opening inventory (#)',
                    'Packaged - Vegetative cannabis plants - Additions - Produced (#)',
                    'Packaged - Vegetative cannabis plants - Additions - Received - domestic (#)',
                    'Packaged - Vegetative cannabis plants - Additions - Received - imported (#)',
                    'Packaged - Vegetative cannabis plants - Additions - Received - returned (#)',
                    'Packaged - Vegetative cannabis plants - Additions - Other (#)',
                    'Packaged - Vegetative cannabis plants - Reductions - Processed (#)',
                    'Packaged - Vegetative cannabis plants - Reductions - Packaged and labeled (#)',
                    'Packaged - Vegetative cannabis plants - Reductions - Shipped - domestic - to analytical testers (#)',
                    'Packaged - Vegetative cannabis plants - Reductions - Shipped - domestic - to researchers (#)',
                    'Packaged - Vegetative cannabis plants - Reductions - Shipped - domestic - To cultivators and processors (#)',
                    'Packaged - Vegetative cannabis plants - Reductions - Shipped - exported (#)',
                    'Packaged - Vegetative cannabis plants - Reductions - Shipped - exported value ($)',
                    'Packaged - Vegetative cannabis plants - Reductions - Shipped - returned (#)',
                    'Packaged - Vegetative cannabis plants - Reductions - Destroyed (#)',
                    'Packaged - Vegetative cannabis plants - Reductions - Lost/stolen (#)',
                    'Packaged - Vegetative cannabis plants - Reductions - Other (#)',
                    'Packaged - Vegetative cannabis plants - Closing inventory (#)',
                    'Packaged - Vegetative cannabis plants - Closing inventory value ($)',
                    'Packaged - Fresh cannabis - Opening inventory (kg)',
                    'Packaged - Fresh cannabis - Additions - Produced (kg)',
                    'Packaged - Fresh cannabis - Additions - Received - domestic (kg)',
                    'Packaged - Fresh cannabis - Additions - Received - imported (kg)',
                    'Packaged - Fresh cannabis - Additions - Received - returned (kg)',
                    'Packaged - Fresh cannabis - Additions - Other (kg)',
                    'Packaged - Fresh cannabis - Reductions - Processed (kg)',
                    'Packaged - Fresh cannabis - Reductions - Packaged and labeled (kg)',
                    'Packaged - Fresh cannabis - Reductions - Shipped - domestic - to analytical testers (kg)',
                    'Packaged - Fresh cannabis - Reductions - Shipped - domestic - to researchers (kg)',
                    'Packaged - Fresh cannabis - Reductions - Shipped - domestic - To cultivators and processors (kg)',
                    'Packaged - Fresh cannabis - Reductions - Shipped - exported (kg)',
                    'Packaged - Fresh cannabis - Reductions - Shipped - exported value ($)',
                    'Packaged - Fresh cannabis - Reductions - Shipped - returned (kg)',
                    'Packaged - Fresh cannabis - Reductions - Destroyed (kg)',
                    'Packaged - Fresh cannabis - Reductions - Lost/stolen (kg)',
                    'Packaged - Fresh cannabis - Reductions - Other (kg)',
                    'Packaged - Fresh cannabis - Closing inventory (kg)',
                    'Packaged - Fresh cannabis - Closing inventory value ($)',
                    'Packaged - Dried cannabis - Opening inventory (kg)',
                    'Packaged - Dried cannabis - Additions - Produced (kg)',
                    'Packaged - Dried cannabis - Additions - Received - domestic (kg)',
                    'Packaged - Dried cannabis - Additions - Received - imported (kg)',
                    'Packaged - Dried cannabis - Additions - Received - returned (kg)',
                    'Packaged - Dried cannabis - Additions - Other (kg)',
                    'Packaged - Dried cannabis - Reductions - Processed (kg)',
                    'Packaged - Dried cannabis - Reductions - Packaged and labeled (kg)',
                    'Packaged - Dried cannabis - Reductions - Shipped - domestic - to analytical testers (kg)',
                    'Packaged - Dried cannabis - Reductions - Shipped - domestic - to researchers (kg)',
                    'Packaged - Dried cannabis - Reductions - Shipped - domestic - To cultivators and processors (kg)',
                    'Packaged - Dried cannabis - Reductions - Shipped - exported (kg)',
                    'Packaged - Dried cannabis - Reductions - Shipped - exported value ($)',
                    'Packaged - Dried cannabis - Reductions - Shipped - returned (kg)',
                    'Packaged - Dried cannabis - Reductions - Destroyed (kg)',
                    'Packaged - Dried cannabis - Reductions - Lost/stolen (kg)',
                    'Packaged - Dried cannabis - Reductions - Other (kg)',
                    'Packaged - Dried cannabis - Closing inventory (kg)',
                    'Packaged - Dried cannabis - Closing inventory value ($)',
                    'Packaged - Pure Intermediates - Opening inventory (kg)',
                    'Packaged - Pure Intermediates - Additions - Produced (kg)',
                    'Packaged - Pure Intermediates - Additions - Received - domestic (kg)',
                    'Packaged - Pure Intermediates - Additions - Received - imported (kg)',
                    'Packaged - Pure Intermediates - Additions - Received - returned (kg)',
                    'Packaged - Pure Intermediates - Additions - Other (kg)',
                    'Packaged - Pure Intermediates - Reductions - Processed (kg)',
                    'Packaged - Pure Intermediates - Reductions - Packaged and labeled (kg)',
                    'Packaged - Pure Intermediates - Reductions - Shipped - domestic - to analytical testers (kg)',
                    'Packaged - Pure Intermediates - Reductions - Shipped - domestic - to researchers (kg)',
                    'Packaged - Pure Intermediates - Reductions - Shipped - domestic - To cultivators and processors (kg)',
                    'Packaged - Pure Intermediates - Reductions - Shipped - exported (kg)',
                    'Packaged - Pure Intermediates - Reductions - Shipped - exported value ($)',
                    'Packaged - Pure Intermediates - Reductions - Shipped - returned (kg)',
                    'Packaged - Pure Intermediates - Reductions - Destroyed (kg)',
                    'Packaged - Pure Intermediates - Reductions - Lost/stolen (kg)',
                    'Packaged - Pure Intermediates - Reductions - Other (kg)',
                    'Packaged - Pure Intermediates - Closing inventory (kg)',
                    'Packaged - Pure Intermediates - Closing inventory value ($)',
                    'Packaged - Edibles - Solids - Opening inventory (kg)',
                    'Packaged - Edibles - Solids - Additions - Produced (kg)',
                    'Packaged - Edibles - Solids - Additions - Received - domestic (kg)',
                    'Packaged - Edibles - Solids - Additions - Received - imported (kg)',
                    'Packaged - Edibles - Solids - Additions - Received - returned (kg)',
                    'Packaged - Edibles - Solids - Additions - Other (kg)',
                    'Packaged - Edibles - Solids - Reductions - Processed (kg)',
                    'Packaged - Edibles - Solids - Reductions - Packaged and labeled (kg)',
                    'Packaged - Edibles - Solids - Reductions - Shipped - domestic - to analytical testers (kg)',
                    'Packaged - Edibles - Solids - Reductions - Shipped - domestic - to researchers (kg)',
                    'Packaged - Edibles - Solids - Reductions - Shipped - domestic - To cultivators and processors (kg)',
                    'Packaged - Edibles - Solids - Reductions - Shipped - exported (kg)',
                    'Packaged - Edibles - Solids - Reductions - Shipped - exported value ($)',
                    'Packaged - Edibles - Solids - Reductions - Shipped - returned (kg)',
                    'Packaged - Edibles - Solids - Reductions - Destroyed (kg)',
                    'Packaged - Edibles - Solids - Reductions - Lost/stolen (kg)',
                    'Packaged - Edibles - Solids - Reductions - Other (kg)',
                    'Packaged - Edibles - Solids - Closing inventory (kg)',
                    'Packaged - Edibles - Solids - Closing inventory value ($)',
                    'Packaged - Edibles - Non-solids - Opening inventory (kg)',
                    'Packaged - Edibles - Non-solids - Additions - Produced (kg)',
                    'Packaged - Edibles - Non-solids - Additions - Received - domestic (kg)',
                    'Packaged - Edibles - Non-solids - Additions - Received - imported (kg)',
                    'Packaged - Edibles - Non-solids - Additions - Received - returned (kg)',
                    'Packaged - Edibles - Non-solids - Additions - Other (kg)',
                    'Packaged - Edibles - Non-solids - Reductions - Processed (kg)',
                    'Packaged - Edibles - Non-solids - Reductions - Packaged and labeled (kg)',
                    'Packaged - Edibles - Non-solids - Reductions - Shipped - domestic - to analytical testers (kg)',
                    'Packaged - Edibles - Non-solids - Reductions - Shipped - domestic - to researchers (kg)',
                    'Packaged - Edibles - Non-solids - Reductions - Shipped - domestic - To cultivators and processors (kg)',
                    'Packaged - Edibles - Non-solids - Reductions - Shipped - exported (kg)',
                    'Packaged - Edibles - Non-solids - Reductions - Shipped - exported value ($)',
                    'Packaged - Edibles - Non-solids - Reductions - Shipped - returned (kg)',
                    'Packaged - Edibles - Non-solids - Reductions - Destroyed (kg)',
                    'Packaged - Edibles - Non-solids - Reductions - Lost/stolen (kg)',
                    'Packaged - Edibles - Non-solids - Reductions - Other (kg)',
                    'Packaged - Edibles - Non-solids - Closing inventory (kg)',
                    'Packaged - Edibles - Non-solids - Closing inventory value ($)',
                    'Packaged - Extracts - Inhaled - Opening inventory (kg)',
                    'Packaged - Extracts - Inhaled - Additions - Produced (kg)',
                    'Packaged - Extracts - Inhaled - Additions - Received - domestic (kg)',
                    'Packaged - Extracts - Inhaled - Additions - Received - imported (kg)',
                    'Packaged - Extracts - Inhaled - Additions - Received - returned (kg)',
                    'Packaged - Extracts - Inhaled - Additions - Other (kg)',
                    'Packaged - Extracts - Inhaled - Reductions - Processed (kg)',
                    'Packaged - Extracts - Inhaled - Reductions - Packaged and labeled (kg)',
                    'Packaged - Extracts - Inhaled - Reductions - Shipped - domestic - to analytical testers (kg)',
                    'Packaged - Extracts - Inhaled - Reductions - Shipped - domestic - to researchers (kg)',
                    'Packaged - Extracts - Inhaled - Reductions - Shipped - domestic - To cultivators and processors (kg)',
                    'Packaged - Extracts - Inhaled - Reductions - Shipped - exported (kg)',
                    'Packaged - Extracts - Inhaled - Reductions - Shipped - exported value ($)',
                    'Packaged - Extracts - Inhaled - Reductions - Shipped - returned (kg)',
                    'Packaged - Extracts - Inhaled - Reductions - Destroyed (kg)',
                    'Packaged - Extracts - Inhaled - Reductions - Lost/stolen (kg)',
                    'Packaged - Extracts - Inhaled - Reductions - Other (kg)',
                    'Packaged - Extracts - Inhaled - Closing inventory (kg)',
                    'Packaged - Extracts - Inhaled - Closing inventory value ($)',
                    'Packaged - Extracts - Ingested - Opening inventory (kg)',
                    'Packaged - Extracts - Ingested - Additions - Produced (kg)',
                    'Packaged - Extracts - Ingested - Additions - Received - domestic (kg)',
                    'Packaged - Extracts - Ingested - Additions - Received - imported (kg)',
                    'Packaged - Extracts - Ingested - Additions - Received - returned (kg)',
                    'Packaged - Extracts - Ingested - Additions - Other (kg)',
                    'Packaged - Extracts - Ingested - Reductions - Processed (kg)',
                    'Packaged - Extracts - Ingested - Reductions - Packaged and labeled (kg)',
                    'Packaged - Extracts - Ingested - Reductions - Shipped - domestic - to analytical testers (kg)',
                    'Packaged - Extracts - Ingested - Reductions - Shipped - domestic - to researchers (kg)',
                    'Packaged - Extracts - Ingested - Reductions - Shipped - domestic - To cultivators and processors (kg)',
                    'Packaged - Extracts - Ingested - Reductions - Shipped - exported (kg)',
                    'Packaged - Extracts - Ingested - Reductions - Shipped - exported value ($)',
                    'Packaged - Extracts - Ingested - Reductions - Shipped - returned (kg)',
                    'Packaged - Extracts - Ingested - Reductions - Destroyed (kg)',
                    'Packaged - Extracts - Ingested - Reductions - Lost/stolen (kg)',
                    'Packaged - Extracts - Ingested - Reductions - Other (kg)',
                    'Packaged - Extracts - Ingested - Closing inventory (kg)',
                    'Packaged - Extracts - Ingested - Closing inventory value ($)',
                    'Packaged - Extracts - Other - Opening inventory (kg)',
                    'Packaged - Extracts - Other - Additions - Produced (kg)',
                    'Packaged - Extracts - Other - Additions - Received - domestic (kg)',
                    'Packaged - Extracts - Other - Additions - Received - imported (kg)',
                    'Packaged - Extracts - Other - Additions - Received - returned (kg)',
                    'Packaged - Extracts - Other - Additions - Other (kg)',
                    'Packaged - Extracts - Other - Reductions - Processed (kg)',
                    'Packaged - Extracts - Other - Reductions - Packaged and labeled (kg)',
                    'Packaged - Extracts - Other - Reductions - Shipped - domestic - to analytical testers (kg)',
                    'Packaged - Extracts - Other - Reductions - Shipped - domestic - to researchers (kg)',
                    'Packaged - Extracts - Other - Reductions - Shipped - domestic - To cultivators and processors (kg)',
                    'Packaged - Extracts - Other - Reductions - Shipped - exported (kg)',
                    'Packaged - Extracts - Other - Reductions - Shipped - exported value ($)',
                    'Packaged - Extracts - Other - Reductions - Shipped - returned (kg)',
                    'Packaged - Extracts - Other - Reductions - Destroyed (kg)',
                    'Packaged - Extracts - Other - Reductions - Lost/stolen (kg)',
                    'Packaged - Extracts - Other - Reductions - Other (kg)',
                    'Packaged - Extracts - Other - Closing inventory (kg)',
                    'Packaged - Extracts - Other - Closing inventory value ($)',
                    'Packaged - Topicals - Opening inventory (kg)',
                    'Packaged - Topicals - Additions - Produced (kg)',
                    'Packaged - Topicals - Additions - Received - domestic (kg)',
                    'Packaged - Topicals - Additions - Received - imported (kg)',
                    'Packaged - Topicals - Additions - Received - returned (kg)',
                    'Packaged - Topicals - Additions - Other (kg)',
                    'Packaged - Topicals - Reductions - Processed (kg)',
                    'Packaged - Topicals - Reductions - Packaged and labeled (kg)',
                    'Packaged - Topicals - Reductions - Shipped - domestic - to analytical testers (kg)',
                    'Packaged - Topicals - Reductions - Shipped - domestic - to researchers (kg)',
                    'Packaged - Topicals - Reductions - Shipped - domestic - To cultivators and processors (kg)',
                    'Packaged - Topicals - Reductions - Shipped - exported (kg)',
                    'Packaged - Topicals - Reductions - Shipped - exported value ($)',
                    'Packaged - Topicals - Reductions - Shipped - returned (kg)',
                    'Packaged - Topicals - Reductions - Destroyed (kg)',
                    'Packaged - Topicals - Reductions - Lost/stolen (kg)',
                    'Packaged - Topicals - Reductions - Other (kg)',
                    'Packaged - Topicals - Closing inventory (kg)',
                    'Packaged - Topicals - Closing inventory value ($)',
                    'Packaged - Other - Opening inventory (kg)',
                    'Packaged - Other - Additions - Produced (kg)',
                    'Packaged - Other - Additions - Received - domestic (kg)',
                    'Packaged - Other - Additions - Received - imported (kg)',
                    'Packaged - Other - Additions - Received - returned (kg)',
                    'Packaged - Other - Additions - Other (kg)',
                    'Packaged - Other - Reductions - Processed (kg)',
                    'Packaged - Other - Reductions - Packaged and labeled (kg)',
                    'Packaged - Other - Reductions - Shipped - domestic - to analytical testers (kg)',
                    'Packaged - Other - Reductions - Shipped - domestic - to researchers (kg)',
                    'Packaged - Other - Reductions - Shipped - domestic - To cultivators and processors (kg)',
                    'Packaged - Other - Reductions - Shipped - exported (kg)',
                    'Packaged - Other - Reductions - Shipped - exported value ($)',
                    'Packaged - Other - Reductions - Shipped - returned (kg)',
                    'Packaged - Other - Reductions - Destroyed (kg)',
                    'Packaged - Other - Reductions - Lost/stolen (kg)',
                    'Packaged - Other - Reductions - Other (kg)',
                    'Packaged - Other - Closing inventory (kg)',
                    'Packaged - Other - Closing inventory value ($)',
                ];


                $rowData = [];
                // Initialize all values to 0.0000 or 0 for counts
                foreach ($headers as $header) {
                    if (str_contains($header, '(kg)')) {
                        $rowData[] = 0.0000;
                    } elseif (str_contains($header, '(#)')) {
                        $rowData[] = 0;
                    } elseif (str_contains($header, '($)')) {
                        $rowData[] = 0.00;
                    } else {
                        $rowData[] = ''; // For text fields like year, month, licence ID
                    }
                }

                // Set initial metadata
                $rowData[0] = $reportingPeriodYear;
                $rowData[1] = $reportingPeriodMonth;
                $rowData[2] = $licenceNumber;

                // Index mapping for easier access to columns
                $columnIndexMap = array_flip($headers);

                // Fetch all relevant batches and events for the period
                $allBatches = Batch::where('facility_id', $facilityId)
                    ->where('tenant_id', $tenantId)
                    ->get();

                $allEvents = TraceabilityEvent::where('facility_id', $facilityId)
                    ->where('tenant_id', $tenantId)
                    ->whereBetween('created_at', [$startDate->copy()->startOfMonth(), $endDate->copy()->endOfMonth()]) // Events for the whole month
                    ->with('batch') // Load batch to get product_type and is_packaged
                    ->get();

                // Calculate Opening Inventory (simplified: batches existing at start of month)
                // This logic needs to be more robust for a true CTLS report.
                // It should consider all additions/reductions up to the start date.
                $openingBatches = Batch::where('facility_id', $facilityId)
                    ->where('tenant_id', $tenantId)
                    ->where('created_at', '<', $startDate) // Batches created before start date
                    ->get();

                foreach ($openingBatches as $batch) {
                    $productType = $this->mapProductTypeToHCCode($batch->product_type);
                    $packagedStatus = $batch->is_packaged ? 'Packaged' : 'Unpackaged';
                    $unitSuffix = $this->mapUnitToHCCode($batch->units);

                    $columnPrefix = "{$packagedStatus} - {$productType} - ";
                    $openingColumn = $columnPrefix . "Opening inventory ({$unitSuffix})";

                    if (isset($columnIndexMap[$openingColumn])) {
                        $currentQuantity = $batch->current_units;
                        // Convert to kg if needed for non-seed/plant types
                        if ($unitSuffix === 'kg' && strtolower($batch->units ?? '') === 'g') { // Added null coalescing for $batch->units
                            $currentQuantity /= 1000;
                        }
                        $rowData[$columnIndexMap[$openingColumn]] += round($currentQuantity, 4);
                    }
                }


                // Process events for Additions and Reductions within the reporting period
                foreach ($allEvents as $event) {
                    $batch = $event->batch;
                    if (!$batch) continue; // Skip events without associated batch

                    $productType = $this->mapProductTypeToHCCode($batch->product_type);
                    $packagedStatus = $batch->is_packaged ? 'Packaged' : 'Unpackaged';
                    $unitSuffix = $this->mapUnitToHCCode($batch->units); // Unit of the batch affected by the event

                    $quantity = $event->quantity;
                    // Convert to kg if needed for non-seed/plant types and if event unit is 'g'
                    if ($unitSuffix === 'kg' && strtolower($event->unit ?? '') === 'g') { // Added null coalescing for $event->unit
                        $quantity /= 1000;
                    }
                    $quantity = round($quantity, 4); // Round quantities

                    $columnPrefix = "{$packagedStatus} - {$productType} - ";

                    switch ($event->event_type) {
                        case 'harvest':
                            $column = $columnPrefix . "Additions - Produced ({$unitSuffix})";
                            if (isset($columnIndexMap[$column])) {
                                $rowData[$columnIndexMap[$column]] += $quantity;
                            }
                            break;
                        case 'processing':
                            // Processing reduction (input)
                            $reductionColumn = $columnPrefix . "Reductions - Processed ({$unitSuffix})";
                            if (isset($columnIndexMap[$reductionColumn])) {
                                $rowData[$columnIndexMap[$reductionColumn]] += $quantity;
                            }
                            // Processing addition (output) - this is complex, as it creates a new product type
                            // For simplicity, we'll assume the 'processing' event's quantity is the input quantity
                            // and the output is handled by a new batch creation.
                            // CTLS might expect a separate "Additions - Processed" for the output product.
                            // This part needs careful review with official CTLS docs.
                            break;
                        case 'movement':
                            // Assuming 'movement' can be 'received' or 'shipped'
                            // This requires more granular 'movement' event data (e.g., origin_type, destination_type)
                            // For now, we'll simplify.
                            // Additions - Received - domestic (from other internal facilities, or external domestic)
                            // Reductions - Shipped - domestic (to other internal facilities, or external domestic)
                            // Reductions - Shipped - exported
                            // For this simplified version, we'll not populate these specifically unless more data is available.
                            break;
                        case 'destruction':
                            $column = $columnPrefix . "Reductions - Destroyed ({$unitSuffix})";
                            if (isset($columnIndexMap[$column])) {
                                $rowData[$columnIndexMap[$column]] += $quantity;
                            }
                            break;
                        case 'loss_theft':
                            $column = $columnPrefix . "Reductions - Lost/stolen ({$unitSuffix})";
                            if (isset($columnIndexMap[$column])) {
                                $rowData[$columnIndexMap[$column]] += $quantity;
                            }
                            break;
                        // Other additions/reductions not directly mapped by current events will remain 0
                    }
                }

                // Calculate Closing Inventory (simplified: current units of batches existing at end of month)
                // This is a simplified calculation. A true closing inventory would be:
                // Opening Inventory + Additions - Reductions
                // For now, we'll use current_units of batches that exist at endDate.
                $closingBatches = Batch::where('facility_id', $facilityId)
                    ->where('tenant_id', $tenantId)
                    ->where('created_at', '<=', $endDate)
                    ->get();

                foreach ($closingBatches as $batch) {
                    $productType = $this->mapProductTypeToHCCode($batch->product_type);
                    $packagedStatus = $batch->is_packaged ? 'Packaged' : 'Unpackaged';
                    $unitSuffix = $this->mapUnitToHCCode($batch->units);

                    $columnPrefix = "{$packagedStatus} - {$productType} - ";
                    $closingColumn = $columnPrefix . "Closing inventory ({$unitSuffix})";

                    if (isset($columnIndexMap[$closingColumn])) {
                        $currentQuantity = $batch->current_units;
                        // Convert to kg if needed for non-seed/plant types
                        if ($unitSuffix === 'kg' && strtolower($batch->units ?? '') === 'g') { // Added null coalescing for $batch->units
                            $currentQuantity /= 1000;
                        }
                        $rowData[$columnIndexMap[$closingColumn]] += round($currentQuantity, 4);
                    }
                }

                $data->push($rowData); // Only one row for this report type
                break;

            case 'production':
                $events = TraceabilityEvent::where('facility_id', $facilityId)
                    ->where('tenant_id', $tenantId)
                    ->whereIn('event_type', ['harvest', 'processing'])
                    ->whereBetween('created_at', [$startDate, $endDate])
                    ->with(['batch', 'user'])
                    ->get();

                $headers = [
                    'Reporting_Period_Year',
                    'Reporting_Period_Month',
                    'Licence_Number',
                    'Site_ID',
                    'Event_ID',
                    'Event_Type_HC_Code',
                    'Event_Timestamp',
                    'Batch_ID_Affected',
                    'Batch_Name_Affected',
                    'Quantity_Produced_Reported',
                    'Unit_of_Measure_HC_Code',
                    'Production_Method_HC_Code',
                    'Notes',
                    'User_ID_Performed_By',
                    'User_Name_Performed_By',
                ];

                $data = $events->map(function ($event) use ($reportingPeriodYear, $reportingPeriodMonth, $licenceNumber, $siteId) {
                    $description = $event->description ?: ($event->method ?: 'N/A');
                    $productionMethodHcc = $event->method ? strtoupper(str_replace(' ', '_', $event->method)) : 'N/A';

                    $quantity = $event->quantity;
                    $unit = $event->unit ?: 'g';
                    $unitHcc = $this->mapUnitToHCCode($unit);

                    // Convert to kg if needed and unit is 'g'
                    if (strtolower($unit) === 'g' && $unitHcc === 'kg') {
                        $quantity = round($quantity / 1000, 4);
                    } else {
                        $quantity = round($quantity, 4);
                    }

                    return [
                        $reportingPeriodYear,
                        $reportingPeriodMonth,
                        $licenceNumber,
                        $siteId,
                        $event->id,
                        $this->mapEventTypeToHCCode($event->event_type),
                        $event->created_at->toIso8601String(),
                        $event->batch_id,
                        $event->batch ? $event->batch->name : 'N/A',
                        $quantity,
                        $unitHcc,
                        $productionMethodHcc,
                        $description,
                        $event->user_id,
                        $event->user ? $event->user->name : 'N/A',
                    ];
                });
                break;

            case 'disposition':
                $events = TraceabilityEvent::where('facility_id', $facilityId)
                    ->where('tenant_id', $tenantId)
                    ->whereIn('event_type', ['movement', 'destruction', 'loss_theft'])
                    ->whereBetween('created_at', [$startDate, $endDate])
                    ->with(['batch', 'user', 'area', 'newBatch'])
                    ->get();

                $headers = [
                    'Reporting_Period_Year',
                    'Reporting_Period_Month',
                    'Licence_Number',
                    'Site_ID',
                    'Event_ID',
                    'Event_Type_HC_Code',
                    'Event_Timestamp',
                    'Batch_ID_Affected',
                    'Batch_Name_Affected',
                    'Quantity_Disposed_Reported',
                    'Unit_of_Measure_HC_Code',
                    'From_Location_Identifier',
                    'To_Location_Identifier',
                    'Reason_Method_HC_Code',
                    'Notes',
                    'User_ID_Performed_By',
                    'User_Name_Performed_By',
                ];

                $data = $events->map(function ($event) use ($reportingPeriodYear, $reportingPeriodMonth, $licenceNumber, $siteId) {
                    $reasonOrMethod = $event->reason ?: ($event->method ?: 'N/A');
                    $dispositionReasonMethodHcc = $event->reason ? strtoupper(str_replace(' ', '_', $event->reason)) : ($event->method ? strtoupper(str_replace(' ', '_', $event->method)) : 'N/A');

                    $fromLocation = $event->from_location ?: ($event->area ? $event->area->name : 'N/A');
                    $toLocation = $event->to_location ?: ($event->newBatch ? $event->newBatch->name : 'N/A');

                    $quantity = $event->quantity;
                    $unit = $event->unit ?: 'g';
                    $unitHcc = $this->mapUnitToHCCode($unit);

                    // Convert to kg if needed and unit is 'g'
                    if (strtolower($unit) === 'g' && $unitHcc === 'kg') {
                        $quantity = round($quantity / 1000, 4);
                    } else {
                        $quantity = round($quantity, 4);
                    }

                    return [
                        $reportingPeriodYear,
                        $reportingPeriodMonth,
                        $licenceNumber,
                        $siteId,
                        $event->id,
                        $this->mapEventTypeToHCCode($event->event_type),
                        $event->created_at->toIso8601String(),
                        $event->batch_id,
                        $event->batch ? $event->batch->name : 'N/A',
                        $quantity,
                        $unitHcc,
                        $fromLocation,
                        $toLocation,
                        $dispositionReasonMethodHcc,
                        $event->description ?: 'N/A',
                        $event->user_id,
                        $event->user ? $event->user->name : 'N/A',
                    ];
                });
                break;

            default:
                Log::warning('RegulatoryReportController@generateCtls: Unsupported report type requested: ' . $reportType);
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

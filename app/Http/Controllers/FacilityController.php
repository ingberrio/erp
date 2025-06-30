<?php

namespace App\Http\Controllers;

use App\Models\Facility;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Illuminate\Support\Facades\Log;

class FacilityController extends Controller
{
    /**
     * Display a listing of the resource.
     * GET /api/facilities
     */
    public function index(Request $request)
    {
        $tenantId = $request->header('X-Tenant-ID');
        if (!$tenantId) {
            return response()->json(['error' => 'Tenant ID is missing.'], 400);
        }

        try {
            $facilities = Facility::where('tenant_id', $tenantId)->get();
            return response()->json($facilities);
        } catch (\Throwable $e) {
            Log::error('Error fetching facilities', [
                'tenant_id' => $tenantId,
                'error_message' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            return response()->json(['error' => 'Failed to fetch facilities.'], 500);
        }
    }

    /**
     * Store a newly created resource in storage.
     * POST /api/facilities
     */
    public function store(Request $request)
    {
        $tenantId = $request->header('X-Tenant-ID');
        if (!$tenantId) {
            return response()->json(['error' => 'Tenant ID is missing.'], 400);
        }

        try {
            $validated = $request->validate([
                'name' => 'required|string|max:255',
                'address' => 'nullable|string|max:1000',
            ]);

            $facility = Facility::create([
                'name' => $validated['name'],
                'address' => $validated['address'] ?? null,
                'tenant_id' => $tenantId,
            ]);

            Log::info('Facility created successfully.', ['facility_id' => $facility->id, 'tenant_id' => $tenantId]);
            return response()->json($facility, 201);
        } catch (ValidationException $e) {
            Log::error('Validation failed during facility store', ['errors' => $e->errors()]);
            return response()->json(['error' => 'Validation failed.', 'details' => $e->errors()], 422);
        } catch (\Throwable $e) {
            Log::error('Unexpected error during facility store', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return response()->json(['error' => 'An unexpected error occurred.', 'details' => $e->getMessage()], 500);
        }
    }

    /**
     * Display the specified resource.
     * GET /api/facilities/{facility}
     */
    public function show(Request $request, Facility $facility)
    {
        $tenantId = $request->header('X-Tenant-ID');
        if ($facility->tenant_id != $tenantId) {
            abort(403, 'Unauthorized access: Facility does not belong to the current tenant.');
        }
        return response()->json($facility);
    }

    /**
     * Update the specified resource in storage.
     * PUT /api/facilities/{facility}
     */
    public function update(Request $request, Facility $facility)
    {
        $tenantId = $request->header('X-Tenant-ID');
        if ($facility->tenant_id != $tenantId) {
            abort(403, 'Unauthorized to update this facility: Facility tenant mismatch.');
        }

        try {
            $validated = $request->validate([
                'name' => 'sometimes|required|string|max:255',
                'address' => 'nullable|string|max:1000',
            ]);

            $facility->update($validated);

            Log::info('Facility updated successfully.', ['facility_id' => $facility->id, 'tenant_id' => $tenantId]);
            return response()->json($facility);
        } catch (ValidationException $e) {
            Log::error('Validation failed during facility update', ['errors' => $e->errors()]);
            return response()->json(['error' => 'Validation failed.', 'details' => $e->errors()], 422);
        } catch (\Throwable $e) {
            Log::error('Unexpected error during facility update', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return response()->json(['error' => 'An unexpected error occurred.', 'details' => $e->getMessage()], 500);
        }
    }

    /**
     * Remove the specified resource from storage.
     * DELETE /api/facilities/{facility}
     */
    public function destroy(Request $request, Facility $facility)
    {
        $tenantId = $request->header('X-Tenant-ID');
        if ($facility->tenant_id != $tenantId) {
            abort(403, 'Unauthorized to delete this facility: Facility tenant mismatch.');
        }

        try {
            $facility->delete();
            Log::info('Facility deleted successfully.', ['facility_id' => $facility->id, 'tenant_id' => $tenantId]);
            return response()->noContent();
        } catch (\Throwable $e) {
            Log::error('Error deleting facility', ['facility_id' => $facility->id, 'error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return response()->json(['error' => 'Failed to delete facility.'], 500);
        }
    }
}

<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

class DiscrepancyReasonController extends Controller
{
    public function index(Request $request)
    {
        // Devuelve una lista de prueba o la lógica real para tus razones
        $reasons = [
            ['id' => 1, 'name' => 'Daño'],
            ['id' => 2, 'name' => 'Pérdida'],
            ['id' => 3, 'name' => 'Error de conteo'],
        ];
        return response()->json($reasons);
    }
}
<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreTraceabilityEventRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        $valid = ['movement','cultivation','harvest','sampling','destruction','loss_theft','processing','inventory_adjustment'];
        $t = $this->input('event_type');

        return [
            'event_type'  => ['required', Rule::in($valid)],
            'area_id'     => ['required','integer','exists:cultivation_areas,id'],
            'facility_id' => ['required','integer','exists:facilities,id'],
            'user_id'     => ['required','integer','exists:users,id'],

            // batch_id NO requerido para 'movement' (agrega 'cultivation' si también lo quieres a nivel de área)
            'batch_id'    => [Rule::requiredIf(fn()=> !in_array($t, ['movement'])), 'nullable','integer','exists:batches,id'],

            // movement exige ubicaciones
            'from_location'     => [Rule::requiredIf(fn()=> $t === 'movement'), 'nullable','string','max:255'],
            'to_location'       => [Rule::requiredIf(fn()=> $t === 'movement'), 'nullable','string','max:255'],
            'from_sub_location' => ['nullable','string','max:255'],
            'to_sub_location'   => ['nullable','string','max:255'],

            // genéricos
            'description'  => ['nullable','string','max:1000'],
            'method'       => ['nullable','string','max:255'],
            'reason'       => ['nullable','string'],
            'new_batch_id' => ['nullable','integer','exists:batches,id'],
            'quantity'     => ['nullable','numeric'],
            'unit'         => ['nullable','string','max:50'],
            'tenant_id'    => ['nullable','integer','exists:tenants,id'],
        ];
    }

    public function messages(): array
    {
        return ['batch_id.required' => 'El lote (batch_id) es requerido para este tipo de evento.'];
    }
}

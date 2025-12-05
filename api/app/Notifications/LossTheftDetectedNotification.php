<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use App\Models\LossTheftReport;

class LossTheftDetectedNotification extends Notification implements ShouldQueue
{
    use Queueable;

    protected LossTheftReport $report;

    /**
     * Create a new notification instance.
     */
    public function __construct(LossTheftReport $report)
    {
        $this->report = $report;
    }

    /**
     * Get the notification's delivery channels.
     *
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['mail', 'database'];
    }

    /**
     * Get the mail representation of the notification.
     */
    public function toMail(object $notifiable): MailMessage
    {
        $urgency = $this->getUrgencyLevel();
        $subject = "[{$urgency}] Cannabis Loss/Theft Detected - Report #{$this->report->report_number}";
        
        $message = (new MailMessage)
            ->subject($subject)
            ->greeting('Loss/Theft Detection Alert')
            ->line("A potential cannabis loss/theft has been detected and requires immediate attention.")
            ->line('')
            ->line("**Report Details:**")
            ->line("Report Number: {$this->report->report_number}")
            ->line("Incident Type: " . ucfirst($this->report->incident_type))
            ->line("Category: " . str_replace('_', ' ', ucfirst($this->report->incident_category)))
            ->line("Facility: {$this->report->facility->name}")
            ->line("Product Type: {$this->report->product_type}")
            ->line("Quantity Lost: {$this->report->quantity_lost} {$this->report->unit}")
            ->line("Estimated Value: $" . number_format($this->report->estimated_value, 2))
            ->line('')
            ->line("**Health Canada Compliance:**")
            ->line($this->getComplianceMessage())
            ->line('');
            
        if ($this->report->batch) {
            $message->line("**Affected Batch:**")
                   ->line("Batch Name: {$this->report->batch->name}")
                   ->line("Batch ID: {$this->report->batch->id}")
                   ->line('');
        }
        
        $message->line("**Immediate Actions Required:**")
               ->line("1. Review and validate the inventory discrepancy")
               ->line("2. Conduct internal investigation")
               ->line("3. Document findings and corrective actions")
               ->line("4. Determine if Health Canada reporting is required")
               ->line('')
               ->action('View Report Details', url('/loss-theft-reports/' . $this->report->id))
               ->line('')
               ->line('This alert was generated automatically by the cannabis ERP system.');
               
        if ($urgency === 'URGENT') {
            $message->line('')
                   ->line('⚠️ **URGENT: This incident meets Health Canada reporting thresholds and may require immediate submission.**');
        }

        return $message;
    }

    /**
     * Get the array representation of the notification.
     *
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return [
            'type' => 'loss_theft_detected',
            'report_id' => $this->report->id,
            'report_number' => $this->report->report_number,
            'incident_type' => $this->report->incident_type,
            'facility_id' => $this->report->facility_id,
            'facility_name' => $this->report->facility->name,
            'quantity_lost' => $this->report->quantity_lost,
            'unit' => $this->report->unit,
            'estimated_value' => $this->report->estimated_value,
            'requires_hc_reporting' => $this->report->requiresHealthCanadaReporting(),
            'urgency' => $this->getUrgencyLevel(),
            'created_at' => $this->report->created_at->toISOString(),
            'message' => "Cannabis {$this->report->incident_type} detected: {$this->report->quantity_lost}{$this->report->unit} from {$this->report->facility->name}",
        ];
    }

    /**
     * Get urgency level based on incident details
     */
    protected function getUrgencyLevel(): string
    {
        // High urgency for theft or large amounts
        if ($this->report->incident_type === 'theft') {
            return 'URGENT';
        }
        
        // High urgency for amounts requiring Health Canada reporting
        if ($this->report->requiresHealthCanadaReporting()) {
            return 'URGENT';
        }
        
        // High urgency for large losses
        if ($this->report->quantity_lost >= 50) {
            return 'HIGH';
        }
        
        return 'MEDIUM';
    }

    /**
     * Get Health Canada compliance message
     */
    protected function getComplianceMessage(): string
    {
        if ($this->report->requiresHealthCanadaReporting()) {
            return "⚠️ This incident meets Health Canada reporting thresholds. A loss/theft report (Form CS-FRM-011) must be submitted within the required timeframe.";
        }
        
        return "This incident is below Health Canada reporting thresholds but must still be documented and investigated per Good Production Practices (GPP) requirements.";
    }

    /**
     * Determine if this notification should be sent immediately
     */
    public function shouldSendNow(): bool
    {
        return $this->report->incident_type === 'theft' || 
               $this->report->requiresHealthCanadaReporting() ||
               $this->report->quantity_lost >= 25;
    }
}

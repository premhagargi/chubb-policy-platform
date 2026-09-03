import { Component, Input } from '@angular/core';
import { PolicySummary } from '../../../core/models/policy-summary.model';

@Component({
  selector: 'app-policy-summary-cards',
  standalone: true,
  templateUrl: './policy-summary-cards.component.html',
  styleUrl: './policy-summary-cards.component.scss'
})
export class PolicySummaryCardsComponent {
  @Input() summary: PolicySummary | null = null;

  protected statusEntries(): [string, number][] {
    return Object.entries(this.summary?.countsByStatus ?? {});
  }

  protected premiumEntries(): [string, number][] {
    return Object.entries(this.summary?.premiumByLineOfBusiness ?? {});
  }

  protected formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
  }
}

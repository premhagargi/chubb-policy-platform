import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AiRiskPanelComponent } from './ai-risk-panel.component';
import { RiskAssessment } from '../../../core/models/ai.model';

/**
 * The recommendation button has to survive the action it triggers being taken.
 *
 * An assessment is a snapshot: the server suppresses `suggestFlag` for a policy
 * that is already flagged, but an assessment taken *before* the operator flagged
 * it still carries `suggestFlag: true`. Without checking live flag state the
 * button stayed on screen after flagging, inviting the same action again.
 */
describe('AiRiskPanelComponent flag recommendation', () => {
  let fixture: ComponentFixture<AiRiskPanelComponent>;
  let httpMock: HttpTestingController;

  const POLICY_ID = '11111111-1111-1111-1111-111111111111';

  const assessment: RiskAssessment = {
    policyId: POLICY_ID,
    policyNumber: 'PCL-100001',
    riskScore: 85,
    riskBand: 'High',
    factors: ['Large premium'],
    recommendation: 'Route to a senior underwriter.',
    suggestFlag: true,
    summary: 'High risk.',
    usage: { provider: 'mock', model: 'mock-llm-v1', latencyMs: 10, cached: false },
    createdAt: '2026-01-01T00:00:00Z',
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AiRiskPanelComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AiRiskPanelComponent);
    fixture.componentRef.setInput('policyId', POLICY_ID);
    fixture.componentRef.setInput('flagged', false);
    fixture.detectChanges();
  });

  afterEach(() => httpMock.verify());

  function runAssessment(): void {
    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    button.click();
    fixture.detectChanges();

    httpMock
      .expectOne(`/api/v1/ai/policies/${POLICY_ID}/risk-assessment`)
      .flush(assessment);
    fixture.detectChanges();
  }

  function flagButton(): HTMLElement | null {
    const buttons = Array.from(
      fixture.nativeElement.querySelectorAll('button')
    ) as HTMLElement[];
    return buttons.find((b) => b.textContent?.includes('Flag as recommended')) ?? null;
  }

  it('offers the flag action when the model recommends it', () => {
    runAssessment();

    expect(flagButton()).not.toBeNull();
  });

  it('withdraws the offer once the policy is flagged', () => {
    runAssessment();
    expect(flagButton()).not.toBeNull();

    fixture.componentRef.setInput('flagged', true);
    fixture.detectChanges();

    expect(flagButton()).toBeNull();
  });

  it('never offers the action for a policy that is already flagged', () => {
    fixture.componentRef.setInput('flagged', true);
    fixture.detectChanges();

    runAssessment();

    expect(flagButton()).toBeNull();
  });
});

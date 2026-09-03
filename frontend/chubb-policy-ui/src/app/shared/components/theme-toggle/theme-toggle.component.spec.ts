import { TestBed } from '@angular/core/testing';
import { ThemeToggleComponent } from './theme-toggle.component';
import { ThemeService } from '../../../core/services/theme.service';

describe('ThemeToggleComponent', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({ imports: [ThemeToggleComponent] }).compileComponents();
  });

  it('reflects the resolved theme via aria-pressed and toggles it on click', () => {
    const fixture = TestBed.createComponent(ThemeToggleComponent);
    const theme = TestBed.inject(ThemeService);
    theme.setPreference('light');
    fixture.detectChanges();

    const button: HTMLButtonElement = fixture.nativeElement.querySelector('button');
    expect(button.getAttribute('aria-pressed')).toBe('false');

    button.click();
    fixture.detectChanges();

    expect(theme.resolvedTheme()).toBe('dark');
    expect(button.getAttribute('aria-pressed')).toBe('true');
  });
});

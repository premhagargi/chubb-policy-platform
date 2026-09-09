import { Routes } from '@angular/router';
import { AppShellComponent } from './layout/app-shell.component';
import { PoliciesPageComponent } from './features/policies/policies-page.component';

/**
 * Four views over one workspace component. Each supplies its own copy and decides
 * which sections render; "Flagged" additionally seeds the flagged filter, so it is a
 * real filtered query rather than a parallel implementation.
 */
export const routes: Routes = [
  {
    path: '',
    component: AppShellComponent,
    children: [
      {
        path: 'dashboard',
        component: PoliciesPageComponent,
        data: {
          title: 'Policy Dashboard',
          subtitle: 'Monitor policy portfolio and operational activity',
          showOverview: true,
          showTable: true,
        },
      },
      {
        path: 'policies',
        component: PoliciesPageComponent,
        data: {
          title: 'Policies',
          subtitle: 'Search, filter and action the full policy register',
          showOverview: false,
          showTable: true,
        },
      },
      {
        path: 'flagged',
        component: PoliciesPageComponent,
        data: {
          title: 'Flagged Policies',
          subtitle: 'Policies marked for operational review',
          showOverview: false,
          showTable: true,
          seedFilter: { flagged: true },
        },
      },
      {
        path: 'analytics',
        component: PoliciesPageComponent,
        data: {
          title: 'Portfolio Analytics',
          subtitle: 'Distribution and composition of the policy portfolio',
          showOverview: true,
          showTable: false,
        },
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./features/settings/settings-page.component').then(
            (m) => m.SettingsPageComponent
          ),
      },
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: '**', redirectTo: 'dashboard' },
    ],
  },
];

import { createRouter, createWebHashHistory } from 'vue-router';
import { session } from './lib/store';

// Hash history, because the app is served from file:// inside the capacitor webview.
export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'home', component: () => import('./views/HomeView.vue') },
    { path: '/spend', name: 'spend', component: () => import('./views/SpendView.vue') },
    { path: '/income', name: 'income', component: () => import('./views/IncomeView.vue') },
    { path: '/lending', name: 'lending', component: () => import('./views/LendingView.vue') },
    { path: '/investment', name: 'investment', component: () => import('./views/InvestmentView.vue') },
    { path: '/analysis', name: 'analysis', component: () => import('./views/AnalysisView.vue') },
    { path: '/settings', name: 'settings', component: () => import('./views/SettingsView.vue') },
    { path: '/login', name: 'login', component: () => import('./views/LoginView.vue') },
    { path: '/:rest(.*)', redirect: '/' }
  ]
});

router.beforeEach((to) => {
  if (!session.value && to.name !== 'login') return { name: 'login' };
  if (session.value && to.name === 'login') return { name: 'home' };
  return true;
});

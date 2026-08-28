import './styles.css';
import { clearState, emptyState, loadState, saveState } from './db';
import { calculateSlots } from './engine';
import { calculationToCsv, calculationToIcs, downloadFile, jsonToState, stateToJson } from './exporters';
import { parseIcs } from './ics';
import { captureLicenseFromUrl, optimisticLicenseState, storeLicense, verifyLicense } from './license';
import { addLocalDays, localDateTime, partsInZone, zonedDateTimeToDate } from './time';
import type { AppState, Calculation, Resource, ResourceKind, Service } from './types';

type Step = 'resources' | 'services' | 'busy' | 'results';

let state = emptyState();
let activeStep: Step = 'resources';
let calculation: Calculation | null = null;
let calculatedServiceId = '';
let isUnlocked = optimisticLicenseState().unlocked;
let deferredInstall: (Event & { prompt?: () => Promise<void> }) | null = null;

const root = document.querySelector<HTMLElement>('#planner-root')!;
const saveStatus = document.querySelector<HTMLElement>('#save-status')!;
const toast = document.querySelector<HTMLElement>('#toast')!;
const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function id(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[character]!);
}

function showToast(message: string): void {
  toast.textContent = message;
  toast.hidden = false;
  window.setTimeout(() => { toast.hidden = true; }, 4200);
}

function announce(message: string): void {
  saveStatus.textContent = message;
}

async function persist(message: string): Promise<void> {
  state.history.unshift({ id: id('history'), at: new Date().toISOString(), message });
  state.history = state.history.slice(0, 20);
  await saveState(state);
  announce('Saved on this device');
}

function localToday(): string {
  const value = partsInZone(new Date(), state.timezone);
  return `${value.year}-${String(value.month).padStart(2, '0')}-${String(value.day).padStart(2, '0')}`;
}

function resourceLabel(resourceId: string): string {
  return state.resources.find((resource) => resource.id === resourceId)?.name ?? 'Removed resource';
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    timeZone: state.timezone,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

function renderStepTabs(): string {
  const steps: Array<[Step, string, string]> = [
    ['resources', '1', 'Resources'],
    ['services', '2', 'Services'],
    ['busy', '3', 'Busy time'],
    ['results', '4', 'Results'],
  ];
  return `<div class="step-tabs" role="tablist" aria-label="Planner steps">${steps.map(([key, number, label]) => `
    <button type="button" role="tab" id="tab-${key}" aria-controls="panel-${key}" aria-selected="${activeStep === key}" tabindex="${activeStep === key ? '0' : '-1'}" data-step="${key}">
      <span>${number}</span>${label}
    </button>`).join('')}</div>`;
}

function renderResources(): string {
  const resourceCards = state.resources.length ? state.resources.map((resource) => `
    <li class="record-row">
      <span class="record-symbol kind-${resource.kind}" aria-hidden="true"></span>
      <div><strong>${escapeHtml(resource.name)}</strong><p>${escapeHtml(resource.kind)} · ${resource.workingHours.weekdays.map((day) => dayNames[day]).join(', ')} · ${resource.workingHours.start}–${resource.workingHours.end}</p></div>
      <button class="icon-button danger-text" type="button" data-delete-resource="${resource.id}" aria-label="Delete ${escapeHtml(resource.name)}">Delete</button>
    </li>`).join('') : `<li class="empty-inline"><strong>No terrain mapped yet.</strong><p>Add each person, room, or piece of equipment that can limit a service.</p></li>`;
  return `
    <div class="panel-grid">
      <div>
        <div class="panel-intro"><p class="coordinate">Layer 01 · resource terrain</p><h3>What can be occupied?</h3><p>Each resource has one regular daily window. Busy calendar events will be subtracted later.</p></div>
        <ul class="record-list">${resourceCards}</ul>
      </div>
      <form id="resource-form" class="survey-form">
        <h3>Add a resource</h3>
        <div class="field"><label for="resource-name">Name</label><input id="resource-name" name="name" required maxlength="60" placeholder="e.g. Maya or Treatment room" /></div>
        <div class="field"><label for="resource-kind">Type</label><select id="resource-kind" name="kind"><option value="person">Person</option><option value="room">Room</option><option value="equipment">Equipment</option><option value="other">Other</option></select></div>
        <fieldset class="day-field"><legend>Usual working days</legend><div>${dayNames.map((day, index) => `<label><input type="checkbox" name="weekday" value="${index}" ${index >= 1 && index <= 5 ? 'checked' : ''} /><span>${day}</span></label>`).join('')}</div></fieldset>
        <div class="field-pair"><div class="field"><label for="work-start">Starts</label><input id="work-start" name="start" type="time" value="09:00" required /></div><div class="field"><label for="work-end">Ends</label><input id="work-end" name="end" type="time" value="17:00" required /></div></div>
        <p class="form-error" id="resource-error" aria-live="polite"></p>
        <button class="primary-button" type="submit">Add resource</button>
      </form>
    </div>`;
}

function requirementRow(index: number): string {
  return `<fieldset class="requirement-row" data-requirement-index="${index}">
    <legend>Requirement ${index + 1}</legend>
    <div class="field-pair"><div class="field"><label for="req-label-${index}">Layer name</label><input id="req-label-${index}" name="req-label-${index}" required placeholder="e.g. Practitioner" /></div><div class="field small-field"><label for="req-quantity-${index}">Needed</label><input id="req-quantity-${index}" name="req-quantity-${index}" type="number" min="1" max="5" value="1" required /></div></div>
    <div class="eligible-field"><span class="field-label">Eligible resources</span><div>${state.resources.map((resource) => `<label><input type="checkbox" name="req-resources-${index}" value="${resource.id}" /><span>${escapeHtml(resource.name)} <small>${resource.kind}</small></span></label>`).join('')}</div></div>
    ${index > 0 ? `<button type="button" class="text-button remove-requirement" data-remove-requirement>Remove this requirement</button>` : ''}
  </fieldset>`;
}

function renderServices(): string {
  if (state.resources.length === 0) return `<div class="gated-empty"><span aria-hidden="true">01 → 02</span><h3>Map resources first</h3><p>A service needs at least one eligible person, room, or piece of equipment.</p><button class="primary-button" type="button" data-step="resources">Go to resources</button></div>`;
  const cards = state.services.length ? state.services.map((service) => `
    <li class="record-row service-record">
      <span class="record-symbol service-symbol" aria-hidden="true"></span>
      <div><strong>${escapeHtml(service.name)}</strong><p>${service.durationMinutes} min · ${service.requirements.map((requirement) => `${requirement.quantity} ${escapeHtml(requirement.label)} (${requirement.resourceIds.length} eligible)`).join(' + ')}</p></div>
      <button class="icon-button danger-text" type="button" data-delete-service="${service.id}" aria-label="Delete ${escapeHtml(service.name)}">Delete</button>
    </li>`).join('') : `<li class="empty-inline"><strong>No service paths yet.</strong><p>Describe the alternatives and combinations that make one service possible.</p></li>`;
  return `<div class="panel-grid services-grid">
    <div><div class="panel-intro"><p class="coordinate">Layer 02 · service paths</p><h3>What does each service need?</h3><p>Resources inside one requirement are alternatives. Separate requirements must all be satisfied.</p></div><ul class="record-list">${cards}</ul></div>
    <form id="service-form" class="survey-form wide-form">
      <h3>Add a service</h3>
      <div class="field-pair"><div class="field"><label for="service-name">Service name</label><input id="service-name" name="name" required maxlength="60" placeholder="e.g. Initial consultation" /></div><div class="field small-field"><label for="service-duration">Minutes</label><input id="service-duration" name="duration" type="number" min="15" max="480" step="15" value="60" required /></div></div>
      <div id="requirements-root">${requirementRow(0)}</div>
      <button type="button" class="text-button" id="add-requirement">+ Add another required layer</button>
      <p class="form-error" id="service-error" aria-live="polite"></p>
      <button class="primary-button" type="submit">Add service</button>
    </form>
  </div>`;
}

function renderBusy(): string {
  if (state.resources.length === 0) return `<div class="gated-empty"><span aria-hidden="true">01 → 03</span><h3>Map resources first</h3><p>Busy time must belong to a specific person, room, or piece of equipment.</p><button class="primary-button" type="button" data-step="resources">Go to resources</button></div>`;
  const blocks = [...state.busyBlocks].sort((a, b) => a.start.localeCompare(b.start));
  return `<div class="panel-grid">
    <div><div class="panel-intro"><p class="coordinate">Layer 03 · occupied contours</p><h3>Subtract known busy time</h3><p>Export an .ics file from each existing calendar, then attach it to the matching resource. Files are parsed in this browser only.</p></div>
      <form id="ics-form" class="survey-form compact-form">
        <div class="field"><label for="ics-resource">Calendar belongs to</label><select id="ics-resource" name="resourceId">${state.resources.map((resource) => `<option value="${resource.id}">${escapeHtml(resource.name)}</option>`).join('')}</select></div>
        <div class="field"><label for="ics-file">ICS calendar file</label><input id="ics-file" name="ics" type="file" accept=".ics,text/calendar" required /><small>The file never leaves this device.</small></div>
        <p class="form-error" id="ics-error" aria-live="polite"></p><button class="primary-button" type="submit">Import busy time</button>
      </form>
    </div>
    <div><div class="list-heading"><h3>Imported blocks</h3><span>${blocks.length}</span></div>
      ${blocks.length ? `<ul class="record-list busy-list">${blocks.map((block) => `<li class="record-row"><span class="busy-hatch" aria-hidden="true"></span><div><strong>${escapeHtml(block.summary)}</strong><p>${escapeHtml(resourceLabel(block.resourceId))} · ${formatDateTime(block.start)} → ${formatDateTime(block.end)}<br /><small>${escapeHtml(block.source)}</small></p></div><button class="icon-button danger-text" type="button" data-delete-block="${block.id}" aria-label="Delete busy block ${escapeHtml(block.summary)}">Delete</button></li>`).join('')}</ul>` : `<div class="empty-inline"><strong>No busy time imported.</strong><p>The calculator can run now, but it will treat every working hour as open.</p></div>`}
    </div>
  </div>`;
}

function resultsMarkup(service: Service): string {
  if (!calculation || calculatedServiceId !== service.id) return `<div class="results-empty"><div class="mini-map" aria-hidden="true"><i></i><i></i><i></i></div><h3>Ready to survey</h3><p>Choose a horizon and calculate. No calendar is changed.</p></div>`;
  const byDay = new Map<string, typeof calculation.slots>();
  for (const slot of calculation.slots) {
    const date = new Intl.DateTimeFormat('en-CA', { timeZone: state.timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(slot.start));
    byDay.set(date, [...(byDay.get(date) ?? []), slot]);
  }
  const recovery = calculation.baselineCount === 0
    ? (calculation.offeredCount > 0 ? 'All found slots' : 'No slots')
    : `${Math.round(calculation.recoveryPercent ?? 0)}% more`;
  return `<div class="result-summary" aria-live="polite">
    <div><strong>${calculation.offeredCount}</strong><span>offerable starts</span></div><div><strong>${calculation.recoveredCount}</strong><span>shared-calendar blocks avoided</span></div><div><strong>${recovery}</strong><span>capacity recovered</span></div>
  </div>
  ${calculation.slots.length ? `<div class="slot-map"><div class="slot-map-key"><span><i></i> Offerable start</span><span>Number = parallel capacity</span></div>${[...byDay.entries()].map(([, slots]) => `<div class="slot-day"><h4>${new Intl.DateTimeFormat(undefined, { timeZone: state.timezone, weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(slots[0].start))}</h4><div>${slots.map((slot) => `<span class="slot-chip" title="Example path: ${slot.exampleResourceIds.map(resourceLabel).join(', ')}">${new Intl.DateTimeFormat(undefined, { timeZone: state.timezone, hour: 'numeric', minute: '2-digit' }).format(new Date(slot.start))}<b>×${slot.capacity}</b></span>`).join('')}</div></div>`).join('')}</div>
  <div class="export-row"><button type="button" class="quiet-button" id="export-csv">Export availability CSV</button><button type="button" class="quiet-button" id="export-ics">Export advisory ICS</button></div>` : `<div class="no-slots"><strong>No conflict-free slots in this range.</strong><p>Check working hours, eligible resource groups, and imported busy time, then survey again.</p></div>`}
  <p class="advisory-note"><strong>Advisory only.</strong> Results are calculations, not reservations. Recheck source calendars before accepting a booking.</p>`;
}

function renderResults(): string {
  if (!state.services.length) return `<div class="gated-empty"><span aria-hidden="true">02 → 04</span><h3>Describe a service first</h3><p>The calculator needs duration and eligible resource requirements.</p><button class="primary-button" type="button" data-step="services">Go to services</button></div>`;
  const selected = state.services.find((service) => service.id === calculatedServiceId) ?? state.services[0];
  return `<div class="results-layout">
    <form id="calculation-form" class="survey-form result-controls">
      <p class="coordinate">Layer 04 · clear contours</p><h3>Survey offerable starts</h3>
      <div class="field"><label for="result-service">Service</label><select id="result-service" name="serviceId">${state.services.map((service) => `<option value="${service.id}" ${selected.id === service.id ? 'selected' : ''}>${escapeHtml(service.name)} · ${service.durationMinutes} min</option>`).join('')}</select></div>
      <div class="field"><label for="result-start">Start date</label><input id="result-start" name="startDate" type="date" value="${localToday()}" required /></div>
      <div class="field"><label for="result-days">Planning horizon</label><select id="result-days" name="days"><option value="7">7 days</option><option value="14" selected>14 days · free</option><option value="28" ${isUnlocked ? '' : 'disabled'}>28 days${isUnlocked ? ' · unlocked' : ' · field kit'}</option></select></div>
      <div class="field-pair"><div class="field"><label for="result-timezone">Timezone</label><input id="result-timezone" name="timezone" value="${escapeHtml(state.timezone)}" required aria-describedby="timezone-help" /></div><div class="field small-field"><label for="result-step">Start every</label><select id="result-step" name="step"><option value="15" ${state.slotStepMinutes === 15 ? 'selected' : ''}>15 min</option><option value="30" ${state.slotStepMinutes === 30 ? 'selected' : ''}>30 min</option><option value="60" ${state.slotStepMinutes === 60 ? 'selected' : ''}>60 min</option></select></div></div>
      <small id="timezone-help">Use an IANA zone, such as America/New_York.</small><p class="form-error" id="calculation-error" aria-live="polite"></p>
      <button class="primary-button" type="submit">Calculate real capacity</button>
      ${!isUnlocked ? `<a class="field-kit-link" href="#upgrade">Need four weeks? Unlock the field kit.</a>` : `<p class="unlocked-note">✓ Four-week field kit unlocked</p>`}
    </form>
    <div class="results-board">${resultsMarkup(selected)}</div>
  </div>`;
}

function renderDataControls(): string {
  return `<details class="data-controls"><summary>Your data & change history</summary><div class="data-controls-grid"><div><h3>Your plan belongs to you</h3><p>Export a complete JSON backup or restore one on another device. Nothing syncs to a server.</p><div class="button-row"><button type="button" class="quiet-button" id="export-json">Export backup</button><label class="quiet-button file-button" for="import-json">Import backup<input id="import-json" type="file" accept="application/json,.json" /></label><button type="button" class="text-button danger-text" id="clear-plan">Clear local plan</button></div></div><div><h3>Recent local changes</h3>${state.history.length ? `<ol class="history-list">${state.history.slice(0, 6).map((entry) => `<li><time datetime="${entry.at}">${new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(entry.at))}</time>${escapeHtml(entry.message)}</li>`).join('')}</ol>` : '<p>No changes recorded yet.</p>'}</div></div></details>`;
}

function render(): void {
  const panel = activeStep === 'resources' ? renderResources() : activeStep === 'services' ? renderServices() : activeStep === 'busy' ? renderBusy() : renderResults();
  root.innerHTML = `${renderStepTabs()}<section class="step-panel" id="panel-${activeStep}" role="tabpanel" aria-labelledby="tab-${activeStep}" tabindex="0">${panel}</section>${renderDataControls()}`;
  root.setAttribute('aria-busy', 'false');
}

function sampleState(): AppState {
  const maya = id('resource');
  const leo = id('resource');
  const room = id('resource');
  const table = id('resource');
  const resources: Resource[] = [
    { id: maya, name: 'Maya', kind: 'person', workingHours: { weekdays: [1, 2, 3, 4, 5], start: '09:00', end: '17:00' } },
    { id: leo, name: 'Leo', kind: 'person', workingHours: { weekdays: [2, 3, 4, 5, 6], start: '10:00', end: '18:00' } },
    { id: room, name: 'Studio room', kind: 'room', workingHours: { weekdays: [1, 2, 3, 4, 5, 6], start: '09:00', end: '18:00' } },
    { id: table, name: 'Treatment table', kind: 'equipment', workingHours: { weekdays: [1, 2, 3, 4, 5, 6], start: '09:00', end: '18:00' } },
  ];
  const today = localToday();
  const block = (resourceId: string, day: number, start: string, end: string, summary: string) => ({
    id: id('busy'), resourceId, summary,
    start: zonedDateTimeToDate(localDateTime(addLocalDays(today, day), start), state.timezone).toISOString(),
    end: zonedDateTimeToDate(localDateTime(addLocalDays(today, day), end), state.timezone).toISOString(),
    source: 'Example calendar',
  });
  return {
    version: 1,
    timezone: state.timezone,
    slotStepMinutes: 30,
    resources,
    services: [
      { id: id('service'), name: 'Initial consultation', durationMinutes: 60, requirements: [
        { id: id('req'), label: 'practitioner', resourceIds: [maya, leo], quantity: 1 },
        { id: id('req'), label: 'room', resourceIds: [room], quantity: 1 },
      ] },
      { id: id('service'), name: 'Treatment session', durationMinutes: 90, requirements: [
        { id: id('req'), label: 'practitioner', resourceIds: [maya, leo], quantity: 1 },
        { id: id('req'), label: 'treatment table', resourceIds: [table], quantity: 1 },
      ] },
    ],
    busyBlocks: [
      block(maya, 1, '10:00', '13:00', 'Client work'),
      block(leo, 1, '13:00', '16:00', 'Training'),
      block(room, 2, '09:00', '11:00', 'Room maintenance'),
      block(maya, 3, '14:00', '17:00', 'Off-site visit'),
    ],
    history: [{ id: id('history'), at: new Date().toISOString(), message: 'Loaded the four-resource example' }],
  };
}

async function loadExample(): Promise<void> {
  if ((state.resources.length || state.services.length) && !window.confirm('Replace your current local plan with the four-resource example?')) return;
  state = sampleState();
  calculation = null;
  activeStep = 'results';
  await saveState(state);
  announce('Example saved on this device');
  render();
  document.querySelector('#planner')?.scrollIntoView({ behavior: 'smooth' });
}

function setError(idValue: string, message: string): void {
  const element = document.getElementById(idValue);
  if (element) element.textContent = message;
}

root.addEventListener('click', async (event) => {
  const target = event.target as HTMLElement;
  const stepButton = target.closest<HTMLElement>('[data-step]');
  if (stepButton?.dataset.step) {
    activeStep = stepButton.dataset.step as Step;
    render();
    document.querySelector(`#tab-${activeStep}`)?.scrollIntoView({ block: 'nearest', inline: 'center' });
    return;
  }
  const resourceId = target.closest<HTMLElement>('[data-delete-resource]')?.dataset.deleteResource;
  if (resourceId) {
    const resource = state.resources.find((item) => item.id === resourceId);
    if (!resource || !window.confirm(`Delete ${resource.name}? Its busy blocks will also be removed, and service paths that use it may stop working.`)) return;
    state.resources = state.resources.filter((item) => item.id !== resourceId);
    state.busyBlocks = state.busyBlocks.filter((item) => item.resourceId !== resourceId);
    state.services = state.services.map((service) => ({ ...service, requirements: service.requirements.map((requirement) => ({ ...requirement, resourceIds: requirement.resourceIds.filter((item) => item !== resourceId) })) }));
    calculation = null;
    await persist(`Deleted resource ${resource.name}`);
    render();
    return;
  }
  const serviceId = target.closest<HTMLElement>('[data-delete-service]')?.dataset.deleteService;
  if (serviceId) {
    const service = state.services.find((item) => item.id === serviceId);
    if (!service || !window.confirm(`Delete the service ${service.name}?`)) return;
    state.services = state.services.filter((item) => item.id !== serviceId);
    calculation = null;
    await persist(`Deleted service ${service.name}`);
    render();
    return;
  }
  const blockId = target.closest<HTMLElement>('[data-delete-block]')?.dataset.deleteBlock;
  if (blockId) {
    const block = state.busyBlocks.find((item) => item.id === blockId);
    if (!block || !window.confirm(`Delete the busy block “${block.summary}”?`)) return;
    state.busyBlocks = state.busyBlocks.filter((item) => item.id !== blockId);
    calculation = null;
    await persist(`Deleted busy block ${block.summary}`);
    render();
    return;
  }
  if (target.closest('#add-requirement')) {
    const requirementsRoot = document.querySelector<HTMLElement>('#requirements-root');
    if (requirementsRoot) requirementsRoot.insertAdjacentHTML('beforeend', requirementRow(requirementsRoot.children.length));
    return;
  }
  if (target.closest('[data-remove-requirement]')) {
    target.closest('.requirement-row')?.remove();
    return;
  }
  if (target.closest('#export-json')) downloadFile(stateToJson(state), 'shared-capacity-plan.json', 'application/json');
  if (target.closest('#clear-plan')) {
    if (!window.confirm('Clear every resource, service, and busy block stored on this device? Export a backup first if you may need it.')) return;
    await clearState();
    state = emptyState();
    calculation = null;
    activeStep = 'resources';
    announce('Local plan cleared');
    render();
  }
  if (target.closest('#export-csv') && calculation) {
    const service = state.services.find((item) => item.id === calculatedServiceId);
    if (service) downloadFile(calculationToCsv(calculation, service, state.timezone), 'availability.csv', 'text/csv');
  }
  if (target.closest('#export-ics') && calculation) {
    const service = state.services.find((item) => item.id === calculatedServiceId);
    if (service) downloadFile(calculationToIcs(calculation, service), 'advisory-availability.ics', 'text/calendar');
  }
});

root.addEventListener('keydown', (event) => {
  const target = event.target as HTMLElement;
  if (target.getAttribute('role') !== 'tab' || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  const order: Step[] = ['resources', 'services', 'busy', 'results'];
  let index = order.indexOf(activeStep);
  if (event.key === 'ArrowRight') index = (index + 1) % order.length;
  if (event.key === 'ArrowLeft') index = (index + order.length - 1) % order.length;
  if (event.key === 'Home') index = 0;
  if (event.key === 'End') index = order.length - 1;
  activeStep = order[index];
  render();
  document.querySelector<HTMLElement>(`#tab-${activeStep}`)?.focus();
});

root.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.target as HTMLFormElement;
  const data = new FormData(form);
  if (form.id === 'resource-form') {
    const name = String(data.get('name') ?? '').trim();
    const start = String(data.get('start'));
    const end = String(data.get('end'));
    const weekdays = data.getAll('weekday').map(Number);
    if (!name || !weekdays.length || start >= end) {
      setError('resource-error', 'Add a name, at least one day, and an end time after the start.');
      return;
    }
    if (!isUnlocked && state.resources.length >= 4) {
      setError('resource-error', 'The free planner includes four resources. The field kit removes this limit.');
      return;
    }
    state.resources.push({ id: id('resource'), name, kind: String(data.get('kind')) as ResourceKind, workingHours: { weekdays, start, end } });
    calculation = null;
    await persist(`Added resource ${name}`);
    render();
  }
  if (form.id === 'service-form') {
    const name = String(data.get('name') ?? '').trim();
    const durationMinutes = Number(data.get('duration'));
    const rows = [...form.querySelectorAll<HTMLElement>('.requirement-row')];
    const requirements = rows.map((row, index) => ({
      id: id('req'),
      label: String(new FormData(form).get(`req-label-${row.dataset.requirementIndex ?? index}`) ?? '').trim(),
      quantity: Number(new FormData(form).get(`req-quantity-${row.dataset.requirementIndex ?? index}`)),
      resourceIds: new FormData(form).getAll(`req-resources-${row.dataset.requirementIndex ?? index}`).map(String),
    }));
    const invalid = requirements.some((requirement) => !requirement.label || !requirement.resourceIds.length || requirement.quantity < 1 || requirement.quantity > requirement.resourceIds.length);
    if (!name || !durationMinutes || invalid) {
      setError('service-error', 'Name every requirement, select enough eligible resources, and keep “needed” within that selection.');
      return;
    }
    if (!isUnlocked && state.services.length >= 3) {
      setError('service-error', 'The free planner includes three services. The field kit removes this limit.');
      return;
    }
    state.services.push({ id: id('service'), name, durationMinutes, requirements });
    calculation = null;
    await persist(`Added service ${name}`);
    render();
  }
  if (form.id === 'ics-form') {
    const input = form.querySelector<HTMLInputElement>('#ics-file')!;
    const file = input.files?.[0];
    if (!file) { setError('ics-error', 'Choose an ICS file to import.'); return; }
    try {
      const result = parseIcs(await file.text(), String(data.get('resourceId')), file.name, state.timezone);
      const existing = new Set(state.busyBlocks.map((block) => block.id));
      const additions = result.blocks.filter((block) => !existing.has(block.id));
      state.busyBlocks.push(...additions);
      calculation = null;
      await persist(`Imported ${additions.length} busy blocks from ${file.name}`);
      showToast(`Imported ${additions.length} busy blocks${result.skipped ? `; skipped ${result.skipped} unsupported or malformed events` : ''}.`);
      render();
    } catch (error) {
      setError('ics-error', error instanceof Error ? error.message : 'Could not read that ICS file.');
    }
  }
  if (form.id === 'calculation-form') {
    const service = state.services.find((item) => item.id === String(data.get('serviceId')));
    if (!service) return;
    const timezone = String(data.get('timezone')).trim();
    const days = Number(data.get('days'));
    try {
      new Intl.DateTimeFormat('en', { timeZone: timezone }).format();
      if (days > 14 && !isUnlocked) throw new Error('A license is required for the four-week horizon.');
      state.timezone = timezone;
      state.slotStepMinutes = Number(data.get('step'));
      calculation = calculateSlots({ resources: state.resources, service, busyBlocks: state.busyBlocks, timezone, startDate: String(data.get('startDate')), days, stepMinutes: state.slotStepMinutes });
      calculatedServiceId = service.id;
      await persist(`Calculated ${days} days for ${service.name}`);
      render();
      document.querySelector('.results-board')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (error) {
      setError('calculation-error', error instanceof Error ? error.message : 'Could not calculate this range.');
    }
  }
});

root.addEventListener('change', async (event) => {
  const target = event.target as HTMLInputElement;
  if (target.id !== 'import-json' || !target.files?.[0]) return;
  try {
    const next = jsonToState(await target.files[0].text());
    if (!window.confirm('Replace the current local plan with this backup?')) return;
    state = next;
    calculation = null;
    await persist('Restored plan from a JSON backup');
    render();
  } catch (error) {
    showToast(error instanceof Error ? error.message : 'Could not import that backup.');
  }
});

document.querySelector('#load-example-hero')?.addEventListener('click', loadExample);

document.querySelector<HTMLFormElement>('#restore-license')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget as HTMLFormElement;
  const status = document.querySelector<HTMLElement>('#license-status')!;
  try {
    storeLicense(String(new FormData(form).get('license') ?? ''));
    status.textContent = 'Checking license…';
    const result = await verifyLicense(true);
    isUnlocked = result.unlocked;
    status.textContent = result.unlocked ? 'Field kit unlocked on this device.' : (result.notice ?? 'That license is not valid.');
    render();
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : 'Could not restore that license.';
  }
});

function updateNetworkStatus(): void {
  const status = document.querySelector<HTMLElement>('#network-status')!;
  status.textContent = navigator.onLine ? 'Online; planner data remains local' : 'Offline; planner remains available';
  document.body.classList.toggle('is-offline', !navigator.onLine);
}

window.addEventListener('online', updateNetworkStatus);
window.addEventListener('offline', updateNetworkStatus);
updateNetworkStatus();

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredInstall = event as typeof deferredInstall;
  document.querySelector<HTMLButtonElement>('#install-app')!.hidden = false;
});

document.querySelector('#install-app')?.addEventListener('click', async () => {
  await deferredInstall?.prompt?.();
  deferredInstall = null;
  document.querySelector<HTMLButtonElement>('#install-app')!.hidden = true;
});

async function registerServiceWorker(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.register('/sw.js');
    registration.addEventListener('updatefound', () => {
      const worker = registration.installing;
      worker?.addEventListener('statechange', () => {
        if (worker.state === 'activated' && navigator.serviceWorker.controller) showToast('App updated. Reload when convenient.');
      });
    });
  } catch {
    showToast('Offline setup will retry on the next visit.');
  }
}

async function init(): Promise<void> {
  captureLicenseFromUrl();
  isUnlocked = optimisticLicenseState().unlocked;
  try {
    state = await loadState();
    announce('Saved locally · no cloud account');
  } catch {
    state = emptyState();
    announce('Local storage is unavailable; changes may not survive a refresh');
  }
  render();
  void registerServiceWorker();
  const verified = await verifyLicense();
  isUnlocked = verified.unlocked;
  if (verified.notice) document.querySelector<HTMLElement>('#license-status')!.textContent = verified.notice;
  render();
}

void init();

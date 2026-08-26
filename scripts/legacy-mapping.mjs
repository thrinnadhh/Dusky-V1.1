const DOMAIN_ROOTS = ['apps/', 'backend/', '.github/', 'scripts/', 'packages/'];

export function normalizeSourcePath(input) {
  const normalized = input.replaceAll('\\', '/').replace(/^\.\//, '');
  if (!normalized.startsWith('/')) return normalized;
  const candidates = DOMAIN_ROOTS.map((root) => ({ root, index: normalized.indexOf(`/${root}`) }))
    .filter(({ index }) => index >= 0)
    .sort((left, right) => left.index - right.index);
  if (!candidates.length) throw new Error(`Cannot normalize source path: ${input}`);
  return normalized.slice(candidates[0].index + 1);
}

export function sourceModuleFor(input) {
  const path = normalizeSourcePath(input);
  if (path.startsWith('apps/customer-app/')) return 'Customer';
  if (path.startsWith('apps/merchant-app/')) return 'Merchant';
  if (path.startsWith('apps/captain-app/')) return 'Captain';
  if (/^apps\/(?:admin|admin-web)\//.test(path)) return 'Admin';
  if (path.startsWith('backend/')) return 'Backend';
  return 'E2E';
}

const rule = (id, module, contracts, options = {}) => ({
  id,
  module,
  contracts,
  path: options.path,
  name: options.name,
  disposition: options.disposition ?? 'mapped',
  evidence: options.evidence,
});

const customerRules = [
  rule('CUS-LOCAL-DEMO-DATA', 'Customer', ['FOUND-FIX-001'], {
    path: /src\/demo\/__tests__\/customer-data\.test\./,
    disposition: 'implementation-specific-rewritten',
    evidence:
      'Demo fixture determinism is retained as greenfield foundation-fixture quality evidence.',
  }),
  rule('CUS-LOCAL-DEMO-ISOLATION', 'Customer', ['FOUND-CI-001'], {
    path: /demo-isolation-architecture\.test\./,
    disposition: 'implementation-specific-rewritten',
    evidence:
      'Legacy demo-module boundaries are implementation-specific and are rewritten as repository-policy evidence.',
  }),
  rule('CUS-LOCAL-CAPABILITY-GATES', 'Customer', ['FOUND-FIX-001'], {
    path: /backend-capabilities\.test\./,
    disposition: 'implementation-specific-rewritten',
    evidence:
      'Deferred-capability fakes are implementation-specific and are rewritten into deterministic-provider evidence.',
  }),
  rule('CUS-TRANSPORT-ORIGIN', 'Customer', ['BE-CORS-001', 'CUS-SES-001'], {
    path: /api-client-transport\.test\./,
    name: /(absolute origin|bearer token.*origin|origin leakage)/,
  }),
  rule('CUS-TRANSPORT-IDEMPOTENCY', 'Customer', ['BE-IDEMP-001', 'CUS-OFF-001'], {
    path: /api-client-transport\.test\./,
    name: /(idempot|replay|mutation)/,
  }),
  rule('CUS-TRANSPORT-RETRY', 'Customer', ['BE-RATE-001', 'CUS-OFF-001'], {
    path: /api-client-transport\.test\./,
    name: /(retry|retry-after|timeout|cancellation|abort)/,
  }),
  rule('CUS-TRANSPORT-SESSION', 'Customer', ['BE-VALID-001', 'CUS-SES-001'], {
    path: /api-client-(?:transport|auth-epoch)\.test\./,
  }),
  rule('CUS-REFRESH', 'Customer', ['BE-AUTH-001', 'CUS-AUTH-001', 'CUS-SES-001'], {
    path: /api-client-refresh\.test\./,
  }),
  rule('CUS-PAGINATION', 'Customer', ['BE-PAGE-001', 'CUS-PROV-001'], {
    path: /paginated-catalog\.test\./,
  }),
  rule('CUS-P5-CART-PRODUCT', 'Customer', ['CUS-CART-001', 'CUS-CART-002', 'CUS-PDP-001'], {
    path: /p5-product-detail-cart-contract\.test\./,
  }),
  rule('CUS-JOURNEY-PAYMENT-AUTHORITY', 'Customer', ['BE-PAY-001', 'CUS-PAY-001'], {
    path: /customer-journey-contracts\.test\./,
    name: /(payment amount|cashfree|customer-payment|online-or-provider|non-chargeable)/,
  }),
  rule('CUS-JOURNEY-APPOINTMENT', 'Customer', ['CUS-APT-001', 'CUS-APT-002'], {
    path: /customer-journey-contracts\.test\./,
    name: /(appointment|grooming|veterinary)/,
  }),
  rule('CUS-JOURNEY-RECURRING', 'Customer', ['CUS-REC-001'], {
    path: /customer-journey-contracts\.test\./,
    name: /recurring/,
  }),
  rule('CUS-JOURNEY-ORDER', 'Customer', ['CUS-CHK-001', 'CUS-ORD-001'], {
    path: /customer-journey-contracts\.test\./,
    name: /(checkout|order|pickup|delivery)/,
  }),
  rule('CUS-JOURNEY-DISCOVERY', 'Customer', ['CUS-DISC-001', 'CUS-PROV-001'], {
    path: /customer-journey-contracts\.test\./,
  }),
  rule('CUS-CATALOG-FILTERS', 'Customer', ['CUS-PROV-001', 'CUS-SEARCH-001'], {
    path: /(?:food-filter-tags|s12-commerce)\.test\./,
  }),
  rule('CUS-AUTH', 'Customer', ['CUS-AUTH-001', 'CUS-SES-001'], {
    path: /(auth|session|otp|login|logout)/,
  }),
  rule('CUS-PAYMENT', 'Customer', ['BE-PAY-001', 'CUS-PAY-001'], {
    name: /(payment|cashfree|webhook|refund|\bcod\b)/,
  }),
  rule('CUS-APPOINTMENT', 'Customer', ['CUS-APT-002'], {
    name: /(appointment|booking|service slot|\bslots\b|no-show)/,
  }),
  rule('CUS-CARE-DISCOVERY', 'Customer', ['CUS-APT-001'], {
    name: /(groom|veterinar|care provider)/,
  }),
  rule('CUS-CART', 'Customer', ['CUS-CART-001', 'CUS-CART-002'], {
    name: /(cart|stock revalidation|stale price|quote line)/,
  }),
  rule('CUS-CHECKOUT-PRICE', 'Customer', ['CUS-CHK-001', 'CUS-PRICE-001'], {
    name: /(checkout|quote|coupon|fee|reward)/,
  }),
  rule('CUS-ORDER', 'Customer', ['CUS-ORD-001'], { name: /(order|delivery history)/ }),
  rule('CUS-LOYALTY', 'Customer', ['CUS-LOY-001'], { name: /(loyalty|star|reward)/ }),
  rule('CUS-RECURRING', 'Customer', ['CUS-REC-001'], { name: /(recurring|renewal)/ }),
  rule('CUS-PROFILE', 'Customer', ['CUS-PROF-001'], { name: /(profile|address|\bpet\b)/ }),
  rule('CUS-NOTIFICATION', 'Customer', ['CUS-NOT-001'], {
    name: /(notification|deep link)/,
  }),
  rule('CUS-OFFLINE', 'Customer', ['CUS-OFF-001'], {
    name: /(offline|reconnect|network recovery)/,
  }),
  rule('CUS-FAVOURITES', 'Customer', ['CUS-FAV-001'], { name: /favou?rite/ }),
  rule('CUS-SERVICEABILITY', 'Customer', ['CUS-SVC-001'], {
    name: /(postal|pincode|serviceab)/,
  }),
  rule('CUS-PRODUCT', 'Customer', ['CUS-PDP-001'], {
    name: /(product detail|variant|gallery)/,
  }),
  rule('CUS-ACCESSIBILITY', 'Customer', ['CUS-A11Y-001'], {
    name: /(accessib|screen reader|focus|navigation)/,
  }),
  rule('CUS-DISCOVERY', 'Customer', ['CUS-PROV-001', 'CUS-SEARCH-001'], {
    name: /(catalog|provider|discover|category|search|filter|product|shop|listing)/,
  }),
  rule('CUS-MESSAGING', 'Customer', ['CUS-NOT-001'], {
    name: /(conversation|message|marking messages read|chat)/,
  }),
  rule('CUS-CUSTOMER-CASE', 'Customer', ['CUS-PROF-001'], {
    name: /(customer-case|case evidence|signed link|vaccination|locale|settings)/,
  }),
  rule('CUS-LOCATION-PROFILE', 'Customer', ['CUS-PROF-001', 'CUS-SVC-001'], {
    name: /(coordinate|device location|location permission)/,
  }),
  rule('CUS-PROMOTIONS', 'Customer', ['CUS-PRICE-001'], { name: /promotion/ }),
  rule('CUS-API-ERROR', 'Customer', ['BE-VALID-001', 'CUS-SES-001'], {
    name: /(api error|structured error|server failure|status fallback)/,
  }),
  rule('CUS-T2B2-CORRECTIONS', 'Customer', ['BE-PAGE-001', 'CUS-CART-002'], {
    path: /t2b2-contract-corrections\.test\./,
  }),
  rule('CUS-ROUTE-CATALOG', 'Customer', ['CUS-PROV-001', 'CUS-SEARCH-001'], {
    path: /route-catalog\.test\./,
  }),
  rule('CUS-MEDICAL-OWNERSHIP', 'Customer', ['BE-OBJ-001', 'CUS-PROF-001'], {
    path: /medical-support-contract\.test\./,
  }),
  rule('CUS-HOME-ENTITLEMENT', 'Customer', ['CUS-LOY-001'], {
    path: /home-entitlement-truth-contract\.test\./,
  }),
  rule('CUS-HOME-LIVE-CONTENT', 'Customer', ['CUS-DISC-001'], {
    path: /home-live-content-contract\.test\./,
  }),
  rule('CUS-PHASE2-UI', 'Customer', ['CUS-A11Y-001', 'CUS-PROF-001'], {
    path: /phase-2-ui-contract\.test\./,
  }),
  rule('CUS-E2E-UI-REGRESSION', 'Customer', ['CUS-A11Y-001'], {
    path: /customer-e2e-regressions\.test\./,
  }),
  rule('CUS-HIGH-RISK-RECURRING', 'Customer', ['CUS-REC-001'], {
    path: /high-risk-customer-services\.test\./,
    name: /create, update, confirm and paginated list/,
  }),
  rule('CUS-HISTORY-OFFLINE', 'Customer', ['CUS-OFF-001', 'CUS-ORD-001'], {
    path: /production-service-coverage\.test\./,
    name: /cached history/,
  }),
  rule('CUS-PROVIDER-SERVICEABILITY', 'Customer', ['CUS-PROV-001', 'CUS-SVC-001'], {
    path: /provider-profile-serviceability\.test\./,
  }),
  rule('CUS-PUSH-SUITE', 'Customer', ['CUS-NOT-001'], {
    path: /usepushnotifications\.test\./,
  }),
  rule('CUS-ORDER-SUITES', 'Customer', ['CUS-ORD-001'], {
    path: /customer-order-(?:detail|list)-contract\.test\./,
  }),
  rule('CUS-CHECKOUT-SUITES', 'Customer', ['CUS-CHK-001', 'CUS-PRICE-001'], {
    path: /customer-(?:checkout|quote)-contract\.test\./,
  }),
  rule('CUS-CARE-SUITES', 'Customer', ['CUS-APT-001', 'CUS-APT-002'], {
    path: /(?:appointment|groom|veterinar)/,
  }),
  rule('CUS-RECURRING-SUITES', 'Customer', ['CUS-REC-001'], { path: /recurring/ }),
  rule('CUS-FAVOURITES-SUITES', 'Customer', ['CUS-FAV-001'], { path: /favourites/ }),
  rule('CUS-NAVIGATION-SUITES', 'Customer', ['CUS-A11Y-001'], {
    path: /(?:navigation|route-pattern|layout|accessibility|i18n|touch-target)/,
  }),
  rule('CUS-SECURITY-SUITES', 'Customer', ['BE-AUTH-001', 'CUS-SES-001'], {
    path: /(?:privacy|security)/,
  }),
  rule('CUS-LOCATION-SUITES', 'Customer', ['CUS-PROF-001', 'CUS-SVC-001'], {
    path: /(?:device-location|installation-id)/,
  }),
  rule('CUS-COMMERCE-SUITES', 'Customer', ['CUS-CART-002', 'CUS-PDP-001'], {
    path: /(?:commerce|product-detail)/,
  }),
  rule('CUS-SERVICE-FOUNDATION-SUITES', 'Customer', ['BE-VALID-001', 'CUS-SES-001'], {
    path: /(?:customer-service-foundations|api-convention-normalization|api-error-formatting)/,
  }),
  rule('CUS-UTILITIES-REWRITE', 'Customer', ['FOUND-CI-001'], {
    path: /(?:production-utilities|app-config|uuid)\.test\./,
    disposition: 'implementation-specific-rewritten',
    evidence:
      'Client utility and configuration assertions are rewritten as greenfield repository-policy evidence.',
  }),
];

const merchantRules = [
  rule('MER-AUTH-OUTLET', 'Merchant', ['MER-AUTH-001', 'MER-OUTLET-001'], {
    name: /(auth|session|login|outlet|tenant)/,
  }),
  rule('MER-BARCODE', 'Merchant', ['MER-BAR-001'], { name: /barcode/ }),
  rule('MER-SYNC', 'Merchant', ['MER-OFF-001', 'MER-SYNC-001', 'MER-MULTI-001'], {
    name: /(offline|sync|replay|conflict|multi-device)/,
  }),
  rule('MER-INVENTORY-MOVEMENT', 'Merchant', ['MER-INV-001', 'MER-MOV-001'], {
    name: /(inventory|stock|movement|adjustment|count|receiv)/,
  }),
  rule('MER-ORDER', 'Merchant', ['MER-ORD-001'], { name: /order/ }),
  rule('MER-APPOINTMENT', 'Merchant', ['MER-APT-001'], { name: /appointment/ }),
  rule('MER-POS', 'Merchant', ['MER-POS-001'], { name: /(point of sale|\bpos\b|receipt)/ }),
  rule('MER-LOYALTY', 'Merchant', ['MER-LOY-001'], { name: /(loyalty|star|reward)/ }),
  rule('MER-NOTIFICATION', 'Merchant', ['MER-NOT-001'], { name: /notification/ }),
  rule('MER-AUDIT', 'Merchant', ['MER-AUD-001'], { name: /audit/ }),
  rule('MER-ACCESSIBILITY', 'Merchant', ['MER-A11Y-001'], { name: /(accessib|focus)/ }),
  rule('MER-AVAILABILITY', 'Merchant', ['MER-AVAIL-001'], {
    name: /(availability|customer visibility)/,
  }),
  rule('MER-CATALOG', 'Merchant', ['MER-CAT-001'], {
    name: /(catalog|product|category|image)/,
  }),
  rule('MER-DASHBOARD', 'Merchant', ['MER-DASH-001'], { name: /dashboard/ }),
  rule('MER-CATALOG-SUITES', 'Merchant', ['MER-CAT-001'], { path: /\/catalog\// }),
  rule('MER-BARCODE-SUITES', 'Merchant', ['MER-BAR-001'], { path: /\/barcode\// }),
  rule('MER-INVENTORY-SUITES', 'Merchant', ['MER-INV-001', 'MER-MOV-001'], {
    path: /\/inventory\//,
  }),
  rule('MER-AUTH-SUITES', 'Merchant', ['MER-AUTH-001', 'MER-OUTLET-001'], {
    path: /\/auth\//,
  }),
  rule('MER-APPOINTMENT-SUITES', 'Merchant', ['MER-APT-001'], { path: /appointment/ }),
  rule('MER-OFFLINE-HARNESS', 'Merchant', ['MER-OFF-001', 'MER-SYNC-001'], {
    path: /offline-harness\.test\./,
  }),
];

const captainRules = [
  rule('CAP-AUTH', 'Captain', ['CAP-AUTH-001'], { name: /(auth|session|login|onboard)/ }),
  rule('CAP-GPS', 'Captain', ['CAP-GPS-001'], { name: /(location|gps|background track)/ }),
  rule('CAP-OFFLINE', 'Captain', ['CAP-OFF-001', 'CAP-STALE-001'], {
    name: /(offline|network|recover|reconcil|stale response)/,
  }),
  rule('CAP-NOTIFICATION', 'Captain', ['CAP-NOT-001'], { name: /(notification|deep link|push)/ }),
  rule('CAP-POD', 'Captain', ['CAP-POD-001'], { name: /(proof|photo|signature|delivery otp)/ }),
  rule('CAP-COD', 'Captain', ['CAP-COD-001'], { name: /(cash|\bcod\b|collection)/ }),
  rule('CAP-CANCEL', 'Captain', ['CAP-CAN-001'], { name: /cancel/ }),
  rule('CAP-LIFECYCLE', 'Captain', ['CAP-LIFE-001'], { name: /(android|lifecycle|restart)/ }),
  rule('CAP-ACCESSIBILITY', 'Captain', ['CAP-A11Y-001'], { name: /(accessib|focus)/ }),
  rule('CAP-STATE', 'Captain', ['CAP-IDEMP-001', 'CAP-STATE-001'], {
    name: /(pickup|delivered|transition|state machine|duplicate action)/,
  }),
  rule('CAP-ASSIGNMENT', 'Captain', ['CAP-ASG-001', 'CAP-CON-001'], {
    name: /(assignment|dispatch|offer|accept|reject|ownership|expiry|concurr|race)/,
  }),
  rule('CAP-AVAILABILITY', 'Captain', ['CAP-AVAIL-001'], { name: /(available|online)/ }),
  rule('CAP-API-CLIENT-SUITES', 'Captain', ['CAP-OFF-001', 'CAP-STALE-001'], {
    path: /api-client-contracts\.test\./,
  }),
  rule('CAP-DISPATCH-SUITES', 'Captain', ['CAP-IDEMP-001', 'CAP-STATE-001'], {
    path: /api\/dispatch\.test\./,
  }),
  rule('CAP-AUTH-PROFILE', 'Captain', ['CAP-AUTH-001'], {
    path: /auth-and-profile-contract\.test\./,
    name: /captain\/profile/,
  }),
  rule('CAP-DELIVERY-HISTORY-EARNINGS', 'Captain', ['CAP-STATE-001'], {
    path: /auth-and-profile-contract\.test\./,
    name: /(delivery\/active|earnings\/summary)/,
  }),
  rule('CAP-SUPPORT', 'Captain', ['CAP-NOT-001'], {
    path: /auth-and-profile-contract\.test\./,
    name: /support\/tickets/,
  }),
  rule('CAP-AVAILABILITY-API', 'Captain', ['CAP-AVAIL-001', 'CAP-GPS-001'], {
    path: /availability-api-contract\.test\./,
  }),
  rule('CAP-NOTIFICATION-SUITES', 'Captain', ['CAP-NOT-001'], {
    path: /\/notifications\//,
  }),
  rule('CAP-LOCATION-FEATURE', 'Captain', ['CAP-GPS-001'], {
    path: /features\/location\.test\./,
  }),
  rule('CAP-LOCATION-SUITES', 'Captain', ['CAP-GPS-001'], { path: /\/location\// }),
  rule('CAP-SYNC-SUITES', 'Captain', ['CAP-IDEMP-001', 'CAP-OFF-001'], { path: /\/sync\// }),
  rule('CAP-AUTH-SUITES', 'Captain', ['CAP-AUTH-001'], { path: /\/auth\// }),
  rule('CAP-STATE-SUITES', 'Captain', ['CAP-ASG-001', 'CAP-STATE-001'], {
    path: /(?:state-machines|durable-commands|backend-contracts|delivery-e2e|truthful-operational-ui)/,
  }),
  rule('CAP-IDEMPOTENCY-UTILS', 'Captain', ['BE-IDEMP-001', 'CAP-IDEMP-001'], {
    path: /idempotency\.test\./,
  }),
  rule('CAP-REPRESENTATION-UTILS', 'Captain', ['BE-REPR-001'], {
    path: /\/(?:date|money)\.test\./,
  }),
  rule('CAP-VALIDATION-UTILS', 'Captain', ['BE-VALID-001'], { path: /validation\.test\./ }),
  rule('CAP-PRIVACY-UTILS', 'Captain', ['CAP-GPS-001'], { path: /privacy\.test\./ }),
  rule('CAP-ARCHITECTURE-REWRITE', 'Captain', ['FOUND-CI-001'], {
    path: /architecture\/runtime-boundaries\.test\./,
    disposition: 'implementation-specific-rewritten',
    evidence:
      'Legacy runtime-boundary assertions are rewritten as greenfield repository-policy evidence.',
  }),
];

const adminRules = [
  rule('ADM-AUTH-RBAC', 'Admin', ['ADM-AUTH-001', 'ADM-RBAC-001'], {
    name: /(auth|role|route protect|permission)/,
  }),
  rule('ADM-MERCHANT', 'Admin', ['ADM-MER-001'], { name: /(merchant|outlet)/ }),
  rule('ADM-USER', 'Admin', ['ADM-USER-001'], { name: /(customer|captain|user)/ }),
  rule('ADM-CATALOG', 'Admin', ['ADM-CAT-001', 'ADM-VIS-001'], {
    name: /(catalog|category|product|moderation|visibility)/,
  }),
  rule('ADM-ORDER', 'Admin', ['ADM-ORD-001'], { name: /order/ }),
  rule('ADM-APPOINTMENT', 'Admin', ['ADM-APT-001'], { name: /appointment/ }),
  rule('ADM-LOYALTY', 'Admin', ['ADM-LOY-001'], { name: /(loyalty|coupon|reward)/ }),
  rule('ADM-OVERRIDE', 'Admin', ['ADM-OVR-001'], { name: /override/ }),
  rule('ADM-AUDIT', 'Admin', ['ADM-AUD-001'], { name: /audit/ }),
  rule('ADM-SEARCH', 'Admin', ['ADM-SEARCH-001'], { name: /(search|paginat)/ }),
  rule('ADM-DESTRUCTIVE', 'Admin', ['ADM-DEST-001'], { name: /(delete|destruct|retention)/ }),
  rule('ADM-INVENTORY', 'Admin', ['ADM-INV-001'], { name: /inventory/ }),
  rule('ADM-ACCESSIBILITY', 'Admin', ['ADM-RESP-001'], { name: /(responsive|accessib|focus)/ }),
  rule('ADM-ADMIN-SUITES', 'Admin', ['ADM-RBAC-001'], {
    path: /^apps\/(?:admin|admin-web)\//,
  }),
];

const backendRules = [
  rule('BE-PAYMENT', 'Backend', ['BE-PAY-001'], { name: /(payment|cashfree|webhook|refund)/ }),
  rule('BE-OTP', 'Backend', ['BE-OTP-001'], { name: /(otp|one.time password)/ }),
  rule('BE-AUTH', 'Backend', ['BE-AUTH-001', 'BE-OBJ-001'], {
    name: /(auth|bearer|principal|security|identity|forbidden)/,
  }),
  rule('BE-TENANT', 'Backend', ['BE-TENANT-001'], { name: /(tenant|outlet|merchant scope)/ }),
  rule('BE-INVENTORY', 'Backend', ['BE-INV-001'], {
    name: /(inventory|stock|catalog|barcode)/,
  }),
  rule('BE-MIGRATION', 'Backend', ['BE-MIG-001'], {
    name: /(migration|flyway|jdbc|postgres|persistence)/,
  }),
  rule('BE-CONCURRENCY', 'Backend', ['BE-CON-001', 'BE-IDEMP-001'], {
    name: /(concurr|race|replay|idempot|duplicate)/,
  }),
  rule('BE-NOTIFICATION', 'Backend', ['BE-NOT-001'], { name: /(notification|firebase|device)/ }),
  rule('BE-AUDIT', 'Backend', ['BE-AUD-001'], { name: /audit/ }),
  rule('BE-PAGINATION', 'Backend', ['BE-PAGE-001'], { name: /(paginat|cursor)/ }),
  rule('BE-REPRESENTATION', 'Backend', ['BE-REPR-001'], {
    name: /(uuid|money|timestamp|timezone)/,
  }),
  rule('BE-RATE', 'Backend', ['BE-RATE-001'], { name: /(rate limit|retry-after|429)/ }),
  rule('BE-CORS', 'Backend', ['BE-CORS-001'], { name: /(cors|origin)/ }),
  rule('BE-STATE', 'Backend', ['BE-STATE-001'], {
    name: /(order|delivery|appointment|state machine|transition)/,
  }),
  rule('BE-LOGGING', 'Backend', ['BE-LOG-001'], { name: /(structured log|trace id|logging)/ }),
  rule('BE-VALIDATION', 'Backend', ['BE-VALID-001'], { name: /(valid|error|request|controller)/ }),
  rule('BE-RECURRING-SUITES', 'Backend', ['BE-CON-001', 'BE-IDEMP-001'], {
    path: /\/recurring\//,
  }),
  rule('BE-DELIVERY-SUITES', 'Backend', ['BE-STATE-001'], { path: /\/delivery\// }),
  rule('BE-CATALOG-SUITES', 'Backend', ['BE-INV-001'], { path: /\/catalog\// }),
  rule('BE-APPLICATION-REWRITE', 'Backend', ['FOUND-CI-001'], {
    path: /\/application\//,
    disposition: 'implementation-specific-rewritten',
    evidence:
      'Runtime configuration assertions are rewritten as greenfield repository-policy evidence.',
  }),
  rule('BE-STORAGE-SUITES', 'Backend', ['BE-VALID-001'], { path: /\/storage\// }),
  rule('BE-SECURITY-SUITES', 'Backend', ['BE-AUTH-001', 'BE-OBJ-001'], {
    path: /\/(?:security|identity)\//,
  }),
  rule('BE-PRIVACY-SUITES', 'Backend', ['BE-AUD-001'], { path: /\/privacy\// }),
  rule('BE-PAYMENT-SUITES', 'Backend', ['BE-PAY-001'], { path: /\/payment\// }),
  rule('BE-MERCHANTOPS-SUITES', 'Backend', ['BE-INV-001', 'BE-TENANT-001'], {
    path: /\/merchantops\//,
  }),
  rule('BE-LOYALTY-SUITES', 'Backend', ['BE-STATE-001'], { path: /\/loyalty\// }),
  rule('BE-ENGAGEMENT-SUITES', 'Backend', ['BE-NOT-001'], { path: /\/engagement\// }),
  rule('BE-CUSTOMER-SUITES', 'Backend', ['BE-STATE-001'], { path: /\/customer\// }),
  rule('BE-COMMON-SUITES', 'Backend', ['BE-REPR-001', 'BE-VALID-001'], {
    path: /\/common\//,
  }),
  rule('BE-COMMERCE-SUITES', 'Backend', ['BE-INV-001', 'BE-STATE-001'], {
    path: /\/commerce\//,
  }),
  rule('BE-APPOINTMENT-SUITES', 'Backend', ['BE-STATE-001'], { path: /\/appointment\// }),
  rule('BE-CAPTAIN-IDENTITY-API', 'Backend', ['BE-AUTH-001', 'CAP-AUTH-001'], {
    path: /api\/captainidentityapitest\.kt$/,
  }),
  rule('BE-CAPTAIN-PROOF-API', 'Backend', ['ADM-USER-001', 'CAP-POD-001'], {
    path: /api\/captainproofandcontractstest\.kt$/,
  }),
  rule('BE-CUSTOMER-DELETION-API', 'Backend', ['ADM-DEST-001', 'BE-AUD-001'], {
    path: /api\/customerdatadeletionapitest\.kt$/,
  }),
  rule('BE-MERCHANT-IDENTITY-API', 'Backend', ['BE-AUTH-001', 'BE-TENANT-001'], {
    path: /api\/merchantidentityapitest\.kt$/,
  }),
  rule('BE-SERVICE-REGION-API', 'Backend', ['BE-VALID-001', 'CUS-SVC-001'], {
    path: /api\/serviceregionapitest\.kt$/,
  }),
  rule('BE-MODULE-BOUNDARY-REWRITE', 'Backend', ['FOUND-CI-001'], {
    path: /architecture\/moduleboundarytest\.kt$/,
    disposition: 'implementation-specific-rewritten',
    evidence:
      'Legacy module dependency assertions are rewritten as greenfield repository-policy evidence.',
  }),
];

const e2eRules = [
  rule('E2E-INVENTORY', 'E2E', ['E2E-INV-001'], { name: /(inventory|availability|stock)/ }),
  rule('E2E-APPOINTMENT', 'E2E', ['E2E-APT-001'], { name: /appointment/ }),
  rule('E2E-POS', 'E2E', ['E2E-POS-001'], { name: /(point of sale|\bpos\b)/ }),
  rule('E2E-MODERATION', 'E2E', ['E2E-MOD-001'], { name: /(moderation|visibility)/ }),
  rule('E2E-PAYMENT', 'E2E', ['E2E-PAY-001'], { name: /(payment|webhook|refund)/ }),
  rule('E2E-NOTIFICATION', 'E2E', ['E2E-NOT-001'], { name: /(notification|deep link)/ }),
  rule('E2E-AUTH', 'E2E', ['E2E-AUTH-001'], { name: /(cross-role|cross-tenant|authorization)/ }),
  rule('E2E-IDEMPOTENCY', 'E2E', ['E2E-IDEMP-001', 'E2E-OFF-001'], {
    name: /(offline|replay|duplicate|idempot|reconcil)/,
  }),
  rule('E2E-ORDER', 'E2E', ['E2E-ORDER-001'], { name: /(order|delivery|captain)/ }),
];

const rulesByModule = {
  Customer: customerRules,
  Merchant: merchantRules,
  Captain: captainRules,
  Admin: adminRules,
  Backend: backendRules,
  E2E: e2eRules,
};

const isToolingEvidence = ({ sourcePath, testCategory, originalTestName }) =>
  sourcePath.startsWith('.github/workflows/') ||
  sourcePath.startsWith('scripts/') ||
  /CI-only|shell validation|file-level test knowledge/i.test(testCategory) ||
  /^CI:|^Shell:/i.test(originalTestName);

export function classifyLegacyEvidence(evidence) {
  const sourcePath = normalizeSourcePath(evidence.sourcePath);
  const sourceModule = sourceModuleFor(sourcePath);
  const originalTestName = evidence.originalTestName.trim();
  const testCategory = evidence.testCategory ?? 'test';
  if (isToolingEvidence({ sourcePath, testCategory, originalTestName })) {
    return {
      sourcePath,
      sourceModule,
      targetDuskyContractIds: ['FOUND-CI-001'],
      disposition: 'implementation-specific-rewritten',
      mappingRuleId: 'FOUNDATION-TOOLING',
      dispositionEvidence:
        'The command validates repository or CI mechanics; it is rewritten as foundation quality evidence and is not product E2E behavior.',
    };
  }

  const path = sourcePath.toLowerCase();
  const name = originalTestName.toLowerCase();
  const matches = rulesByModule[sourceModule].filter(
    (candidate) =>
      (!candidate.path || candidate.path.test(path)) &&
      (!candidate.name || candidate.name.test(name)),
  );
  const selected = matches[0];
  if (!selected) {
    return {
      sourcePath,
      sourceModule,
      targetDuskyContractIds: [],
      disposition: 'requires-business-decision',
      mappingRuleId: 'MANUAL-REVIEW-REQUIRED',
      dispositionEvidence:
        'The normalized path and test name are insufficient for an evidence-backed automatic mapping; manual product review is required.',
    };
  }
  return {
    sourcePath,
    sourceModule,
    targetDuskyContractIds: [...new Set(selected.contracts)].sort(),
    disposition: selected.disposition,
    mappingRuleId: selected.id,
    dispositionEvidence:
      selected.evidence ??
      `Curated rule ${selected.id} maps the normalized ${sourceModule} evidence to its bounded Dusky contract.`,
  };
}

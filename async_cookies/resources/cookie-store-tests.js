'use strict';

// Buffered exceptions re-thrown at end of suite
let savedExceptions = [];

// Observer-based document.cookie simulator
let observer;
let observationLog = [];
let observedStore = [];

// Approximate async observer-based equivalent to the document.cookie
// getter but with important differences: an empty cookie jar returns
// undefined. Introduces unfortunate but apparently unavoidable delays
// to ensure the observer has time to run.
const getCookieStringObserved = async opt_name => {
  // Run later to ensure the cookie scanner (which runs one task
  // later, at least in the polyfill) has a chance.
  if (kHasDocument) {
    const cookieString1 = document.cookie;
    observationLog.push(
        ['getCookieStringObserved:t0:document.cookie', cookieString1]);
  }
  // We cannot use this identifier unescaped inside WPT tests (the
  // linter does not allow it.) However we need an actual delay to
  // allow batched observers to fire.
  await new Promise(resolve => s\u0065tTimeout(resolve));
  if (kHasDocument) {
    const cookieString2 = document.cookie;
    observationLog.push(
        ['getCookieStringObserved:t1:document.cookie', cookieString2]);
  }
  await new Promise(resolve => s\u0065tTimeout(resolve, 4));
  if (kHasDocument) {
    const cookieString4 = document.cookie;
    observationLog.push(
        ['getCookieStringObserved:t2:document.cookie', cookieString4]);
  }
  if (typeof requestAnimationFrame !== 'undefined') {
    await new Promise(resolve => requestAnimationFrame(resolve));
  }
  let filtered = observedStore;
  if (opt_name != null) filtered = filtered.filter(
      cookie => cookie.name === opt_name);
  return cookieString(filtered);
};


const suite = ({testName = undefined} = {}) => {
  promise_test(async testCase => {
    testOverride = testName;
    // Ensure .https. tests are 'https:'
    assert_equals(
        location.pathname.indexOf('.https.html') !== -1,
        (location.protocol === 'https:') ? true :
          (location.protocol === 'http:') ? false : undefined,
        '.https. test should only run with https: and all others with http:' +
          '\n location.protocol: ' + location.protocol +
          '\n location.pathname: ' + location.pathname);
    observer = undefined;
    observationLog.length = 0;
    observedStore.length = 0;
    savedExceptions.length = 0;
    // Attempt resetCookies first too, since otherwise an earlier failed test
    // can cause all subsequent tests to fail.
    try {
      await resetCookies(testCase);
    } catch (earlyResetCookiesException) {
      // ResetCookies errors will happen be re-thrown at the end.
      savedExceptions.push('Exception during early resetCookies');
      savedExceptions.push(earlyResetCookiesException);
    }
    assert_equals(
        await getCookieString(),
        undefined,
        'No cookies at start of test');
    if (!kIsStatic) assert_equals(
        await getCookieStringHttp(),
        undefined,
        'No HTTP cookies at start of test');
    if (kHasDocument) assert_equals(
        await getCookieStringDocument(),
        undefined,
        'No document.cookie cookies at start of test');
    let unfinished = true;
    try {
      if (includeTest('testObservation')) {
        observer = await testObservation();
        assert_equals(
            await getCookieStringObserved(),
            undefined,
            'No observed cookies at start of test');
      }
      // These use the same cookie names and so cannot run interleaved
      if (includeTest('testNoNameAndNoValue')) await testNoNameAndNoValue();
      if (includeTest('testNoNameMultipleValues')) {
        await testNoNameMultipleValues();
      }
      if (includeTest('testNoNameEqualsInValue')) await testNoNameEqualsInValue();
      if (includeTest('testMetaHttpEquivSetCookie')) {
        await testMetaHttpEquivSetCookie();
      }
      if (includeTest('testDocumentCookie', !kHasDocument)) {
        await testDocumentCookie();
      }
      if (includeTest('testHttpCookieAndSetCookieHeaders', kIsStatic)) {
        await testHttpCookieAndSetCookieHeaders();
      }
      await cookieStore.set('TEST', 'value0');
      assert_equals(
          await getCookieString(),
          'TEST=value0',
          'Cookie jar contains only cookie we set');
      if (!kIsStatic) assert_equals(
          await getCookieStringHttp(),
          'TEST=value0',
          'HTTP cookie jar contains only cookie we set');
      if (observer) assert_equals(
          await getCookieStringObserved(),
          'TEST=value0',
          'Observed cookie jar contains only cookie we set');
      await cookieStore.set('TEST', 'value');
      assert_equals(
          await getCookieString(),
          'TEST=value',
          'Cookie jar contains only cookie we overwrote');
      if (!kIsStatic) assert_equals(
          await getCookieStringHttp(),
          'TEST=value',
          'HTTP cookie jar contains only cookie we overwrote');
      if (observer) assert_equals(
          await getCookieStringObserved(),
          'TEST=value',
          'Observed cookie jar contains only cookie we overwrote');
      let allCookies = await cookieStore.getAll();
      assert_equals(
          allCookies[0].name,
          'TEST',
          'First entry in allCookies should be named TEST');
      assert_equals(
          allCookies[0].value,
          'value',
          'First entry in allCookies should have value "value"');
      assert_equals(
          allCookies.length,
          1,
          'Only one cookie should exist in allCookies');
      let firstCookie = await cookieStore.get();
      assert_equals(
          firstCookie.name,
          'TEST',
          'First cookie should be named TEST');
      assert_equals(
          firstCookie.value,
          'value',
          'First cookie should have value "value"');
      let allCookies_TEST = await cookieStore.getAll('TEST');
      assert_equals(
          allCookies_TEST[0].name,
          'TEST',
          'First entry in allCookies_TEST should be named TEST');
      assert_equals(
          allCookies_TEST[0].value,
          'value',
          'First entry in allCookies_TEST should have value "value"');
      assert_equals(
          allCookies_TEST.length,
          1,
          'Only one cookie should exist in allCookies_TEST');
      let firstCookie_TEST = await cookieStore.get('TEST');
      assert_equals(
          firstCookie_TEST.name,
          'TEST',
          'First TEST cookie should be named TEST');
      assert_equals(
          firstCookie_TEST.value,
          'value',
          'First TEST cookie should have value "value"');
      await promise_rejects_when_unsecured(
          testCase,
          new SyntaxError(),
          setOneSimpleOriginSessionCookie(),
          '__Host- prefix only writable from' +
            ' secure contexts (setOneSimpleOriginSessionCookie)');
      if (!kIsUnsecured) {
        assert_equals(
            await getOneSimpleOriginCookie(),
            'cookie-value',
            '__Host-COOKIENAME cookie should be found' +
              ' in a secure context (getOneSimpleOriginCookie)');
      } else {
        assert_equals(
            await getOneSimpleOriginCookie(),
            undefined,
            '__Host-COOKIENAME cookie should not be found' +
              ' in an unsecured context (getOneSimpleOriginCookie)');
      }
      if (!kIsUnsecured) {
        assert_equals(
            await getOneSimpleOriginCookieAsync (),
            'cookie-value',
            '__Host-COOKIENAME cookie should be found' +
              ' in a secure context (getOneSimpleOriginCookieAsync)');
      } else {
        assert_equals(
            await getOneSimpleOriginCookieAsync (),
            undefined,
            '__Host-COOKIENAME cookie should not be found' +
              ' in an unsecured context (getOneSimpleOriginCookieAsync)');
      }
      if (kIsUnsecured) {
        assert_equals(
            await countMatchingSimpleOriginCookies(),
            0,
            'No __Host-COOKIEN* cookies should be found' +
              ' in an unsecured context (countMatchingSimpleOriginCookies)');
      } else {
        assert_equals(
            await countMatchingSimpleOriginCookies(),
            1,
            'One __Host-COOKIEN* cookie should be found' +
              ' in a secur context (countMatchingSimpleOriginCookies)');
      }
      await promise_rejects_when_unsecured(
          testCase,
          new SyntaxError(),
          setOneDaySecureCookieWithDate(),
          'Secure cookies only writable' +
            ' from secure contexts (setOneDaySecureCookieWithDate)');
      await setOneDayUnsecuredCookieWithMillisecondsSinceEpoch();
      assert_equals(
          await getCookieString('LEGACYCOOKIENAME'),
          'LEGACYCOOKIENAME=cookie-value',
          'Ensure unsecured cookie we set is visible');
      if (observer) assert_equals(
          await getCookieStringObserved('LEGACYCOOKIENAME'),
          'LEGACYCOOKIENAME=cookie-value',
          'Ensure unsecured cookie we set is visible to observer');
      await deleteUnsecuredCookieWithDomainAndPath();
      await promise_rejects_when_unsecured(
          testCase,
          new SyntaxError(),
          setSecureCookieWithHttpLikeExpirationString(),
          'Secure cookies only writable from secure contexts' +
            ' (setSecureCookieWithHttpLikeExpirationString)');
      await promise_rejects_when_unsecured(
          testCase,
          new SyntaxError(),
          setThreeSimpleOriginSessionCookiesSequentially(),
          '__Host- cookies only writable from secure contexts' +
            ' (setThreeSimpleOriginSessionCookiesSequentially)');
      await promise_rejects_when_unsecured(
          testCase,
          new SyntaxError(),
          setThreeSimpleOriginSessionCookiesNonsequentially(),
          '__Host- cookies only writable from secure contexts' +
            ' (setThreeSimpleOriginSessionCookiesNonsequentially)');
      await promise_rejects_when_unsecured(
          testCase,
          new SyntaxError(),
          setExpiredSecureCookieWithDomainPathAndFallbackValue(),
          'Secure cookies only writable from secure contexts' +
            ' (setExpiredSecureCookieWithDomainPathAndFallbackValue)');
      await promise_rejects_when_unsecured(
          testCase,
          new SyntaxError(),
          deleteSimpleOriginCookie(),
          '__Host- cookies only writable from secure contexts' +
            ' (deleteSimpleOriginCookie)');
      await promise_rejects_when_unsecured(
          testCase,
          new SyntaxError(),
          deleteSecureCookieWithDomainAndPath(),
          'Secure cookies only writable from secure contexts' +
            ' (deleteSecureCookieWithDomainAndPath)');
      if (kIsUnsecured) {
        assert_equals(
            await getCookieString(),
            'TEST=value',
            'Only one unsecured cookie before resetCookies at end of test');
        if (observer) assert_equals(
            await getCookieStringObserved(),
            'TEST=value',
            'Only one observed unsecured cookie before resetCookies at end of test');
      } else {
        assert_equals(
            await getCookieString(),
            'TEST=value; ' +
              '__Host-🍪=🔵cookie-value1🔴; ' +
              '__Host-🌟=🌠cookie-value2🌠; ' +
              '__Host-🌱=🔶cookie-value3🔷; ' +
              '__Host-unordered🍪=🔵unordered-cookie-value1🔴; ' +
              '__Host-unordered🌟=🌠unordered-cookie-value2🌠; ' +
              '__Host-unordered🌱=🔶unordered-cookie-value3🔷',
            'All residual cookies before resetCookies at end of test');
        if (observer) assert_equals(
            await getCookieStringObserved(),
            'TEST=value; ' +
              '__Host-🍪=🔵cookie-value1🔴; ' +
              '__Host-🌟=🌠cookie-value2🌠; ' +
              '__Host-🌱=🔶cookie-value3🔷; ' +
              '__Host-unordered🍪=🔵unordered-cookie-value1🔴; ' +
              '__Host-unordered🌟=🌠unordered-cookie-value2🌠; ' +
              '__Host-unordered🌱=🔶unordered-cookie-value3🔷',
            'All residual observed cookies before resetCookies at end of test');
      }
      if (kIsUnsecured) {
        if (!kIsStatic) assert_equals(
            await getCookieStringHttp(),
            'TEST=value',
            'Only one unsecured HTTP cookie before resetCookies at end of test');
      } else {
        if (!kIsStatic) assert_equals(
            await getCookieStringHttp(),
            'TEST=value; ' +
              '__Host-🍪=🔵cookie-value1🔴; ' +
              '__Host-🌟=🌠cookie-value2🌠; ' +
              '__Host-🌱=🔶cookie-value3🔷; ' +
              '__Host-unordered🍪=🔵unordered-cookie-value1🔴; ' +
              '__Host-unordered🌟=🌠unordered-cookie-value2🌠; ' +
              '__Host-unordered🌱=🔶unordered-cookie-value3🔷',
            'All residual HTTP cookies before resetCookies at end of test');
      }
      if (kIsUnsecured) {
        if (kHasDocument) assert_equals(
            await getCookieStringDocument(),
            'TEST=value',
            'Only one unsecured document.cookie cookie' +
              ' before resetCookies at end of test');
      } else {
        if (kHasDocument) assert_equals(
            await getCookieStringDocument(),
            'TEST=value; ' +
              '__Host-🍪=🔵cookie-value1🔴; ' +
              '__Host-🌟=🌠cookie-value2🌠; ' +
              '__Host-🌱=🔶cookie-value3🔷; ' +
              '__Host-unordered🍪=🔵unordered-cookie-value1🔴; ' +
              '__Host-unordered🌟=🌠unordered-cookie-value2🌠; ' +
              '__Host-unordered🌱=🔶unordered-cookie-value3🔷',
            'All residual document.cookie cookies before resetCookies at end of test');
      }
      unfinished = false;
      assert_equals(
          savedExceptions.length,
          0,
          'Found saved exceptions: ' + savedExceptions);
    } finally {
      try {
        resetCookies(testCase);
      } catch (e) {
        // only re-throw resetCookies failures if finished to avoid masking
        // earlier failures
        if (!unfinished) throw e;
      }
    }
  }, 'Cookie Store Tests (' + (testName || 'all') + ')');
};


// Try to clean up cookies and observers used by tests.
//
// Parameters:
// - testCase: (TestCase) Context in which the resetCookies is run.
const resetCookies = async testCase => {
  let exceptions = [];
  for (let resetStep of [
    async () => await cookieStore.delete(''),
    async () => await cookieStore.delete('TEST'),
    async () => await cookieStore.delete('META-🍪'),
    async () => await cookieStore.delete('DOCUMENT-🍪'),
    async () => await cookieStore.delete('HTTP-🍪'),
    async () => {
      if (!kIsStatic) await setCookieStringHttp(
          'HTTPONLY-🍪=DELETED; path=/; max-age=0; httponly');
    },
    async () => await promise_rejects_when_unsecured(
        testCase,
        new SyntaxError(),
        cookieStore.delete('__Host-COOKIENAME')),
    async () => await promise_rejects_when_unsecured(
        testCase,
        new SyntaxError(),
        cookieStore.delete('__Host-🍪')),
    async () => await promise_rejects_when_unsecured(
        testCase,
        new SyntaxError(),
        cookieStore.delete('__Host-🌟')),
    async () => await promise_rejects_when_unsecured(
        testCase,
        new SyntaxError(),
        cookieStore.delete('__Host-🌱')),
    async () => await promise_rejects_when_unsecured(
        testCase,
        new SyntaxError(),
        cookieStore.delete('__Host-unordered🍪')),
    async () => await promise_rejects_when_unsecured(
        testCase,
        new SyntaxError(),
        cookieStore.delete('__Host-unordered🌟')),
    async () => await promise_rejects_when_unsecured(
        testCase,
        new SyntaxError(),
        cookieStore.delete('__Host-unordered🌱')),
    async () => assert_equals(
        await getCookieString(),
        undefined,
        'No cookies at end of test'),
    async () => {
      if (!kIsStatic) assert_equals(
          await getCookieStringHttp(),
          undefined,
          'No HTTP cookies at end of test');
    },
    async () => {
      if (observer) assert_equals(
          await getCookieStringObserved(),
          undefined,
          'No observed cookies at end of test');
    },
    async () => {
      if (observer) observer.disconnect();
    }
  ]) {
    try {
      await resetStep();
    } catch (x) {
      exceptions.push(x);
    };
  }
  assert_equals(exceptions.length, 0, 'resetCookies failures: ' + exceptions);
};

// Helper to verify first-of-name get using pre-async .then pattern.
//
// Returns the first script-visible value of the __Host-COOKIENAME cookie or
// undefined if no matching cookies are script-visible.
function getOneSimpleOriginCookie() {
  return cookieStore.get('__Host-COOKIENAME').then(function(cookie) {
    if (!cookie) return undefined;
    return cookie.value;
  });
}


// Helper to verify first-of-name get using async/await.
//
// Returns the first script-visible value of the __Host-COOKIENAME cookie or
// undefined if no matching cookies are script-visible.
let getOneSimpleOriginCookieAsync = async () => {
  let cookie = await cookieStore.get('__Host-COOKIENAME');
  if (!cookie) return undefined;
  return cookie.value;
};

// Returns the number of script-visible cookies whose names start with
// __Host-COOKIEN
let countMatchingSimpleOriginCookies = async () => {
  let cookieList = await cookieStore.getAll({
    name: '__Host-COOKIEN',
    matchType: 'startsWith'
  });
  return cookieList.length;
};

// Set the secure implicit-domain cookie __Host-COOKIENAME with value
// cookie-value on path / and session duration.
let setOneSimpleOriginSessionCookie = async () => {
  await cookieStore.set('__Host-COOKIENAME', 'cookie-value');
};

// Set the secure example.org-domain cookie __Secure-COOKIENAME with
// value cookie-value on path /cgi-bin/ and 24 hour duration; domain
// and path will be rewritten below.
//
// This uses a Date object for expiration.
let setOneDaySecureCookieWithDate = async () => {
  // one day ahead, ignoring a possible leap-second
  let inTwentyFourHours = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await cookieStore.set('__Secure-COOKIENAME', 'cookie-value', {
    path: '/cgi-bin/',
    expires: inTwentyFourHours,
    secure: true,
    domain: 'example.org'
  });
};

// Rewrite domain and path in setOneDaySecureCookieWithDate to match
// current test domain and directory.
//
// FIXME: remove this once IFRAME puppets and ServiceWorker support
// are implemented in the polyfill
setOneDaySecureCookieWithDate =
    eval(String(setOneDaySecureCookieWithDate).split(
        '/cgi-bin/').join(location.pathname.replace(/[^/]+$/, '')));
setOneDaySecureCookieWithDate =
    eval(String(setOneDaySecureCookieWithDate).split(
        'example.org').join(location.hostname));

// Set the unsecured example.org-domain cookie LEGACYCOOKIENAME with
// value cookie-value on path /cgi-bin/ and 24 hour duration; domain
// and path will be rewritten below.
//
// This uses milliseconds since the start of the Unix epoch for
// expiration.
let setOneDayUnsecuredCookieWithMillisecondsSinceEpoch = async () => {
  // one day ahead, ignoring a possible leap-second
  let inTwentyFourHours = Date.now() + 24 * 60 * 60 * 1000;
  await cookieStore.set('LEGACYCOOKIENAME', 'cookie-value', {
    path: '/cgi-bin/',
    expires: inTwentyFourHours,
    secure: false,
    domain: 'example.org'
  });
};

// Rewrite domain and path in
// setOneDayUnsecuredCookieWithMillisecondsSinceEpoch to match current
// test domain and directory.
//
// FIXME: remove this once IFRAME puppets and ServiceWorker support
// are implemented in the polyfill
setOneDayUnsecuredCookieWithMillisecondsSinceEpoch =
    eval(String(setOneDayUnsecuredCookieWithMillisecondsSinceEpoch).split(
        '/cgi-bin/').join(location.pathname.replace(/[^/]+$/, '')));
setOneDayUnsecuredCookieWithMillisecondsSinceEpoch =
    eval(String(setOneDayUnsecuredCookieWithMillisecondsSinceEpoch).split(
        'example.org').join(location.hostname));

// Delete the cookie written by
// setOneDayUnsecuredCookieWithMillisecondsSinceEpoch.
let deleteUnsecuredCookieWithDomainAndPath = async () => {
  await cookieStore.delete('LEGACYCOOKIENAME', {
    path: '/cgi-bin/',
    secure: false,
    domain: 'example.org'
  });
};

// Rewrite deleteUnsecuredCookieWithDomainAndPath to match rewritten
// setOneDayUnsecuredCookieWithMillisecondsSinceEpoch.
//
// FIXME: remove this once IFRAME puppets and ServiceWorker support
// are implemented in the polyfill
deleteUnsecuredCookieWithDomainAndPath =
    eval(String(deleteUnsecuredCookieWithDomainAndPath).split(
        '/cgi-bin/').join(location.pathname.replace(/[^/]+$/, '')));
deleteUnsecuredCookieWithDomainAndPath =
    eval(String(deleteUnsecuredCookieWithDomainAndPath).split(
        'example.org').join(location.hostname));

// Set the secured example.org-domain cookie __Secure-COOKIENAME with
// value cookie-value on path /cgi-bin/ and expiration in June of next
// year; domain and path will be rewritten below.
//
// This uses an HTTP-style date string for expiration.
let setSecureCookieWithHttpLikeExpirationString = async () => {
  const year = (new Date()).getUTCFullYear() + 1;
  const date = new Date('07 Jun ' + year + ' 07:07:07 UTC');
  const day = ('Sun Mon Tue Wed Thu Fri Sat'.split(' '))[date.getUTCDay()];
  await cookieStore.set('__Secure-COOKIENAME', 'cookie-value', {
    path: '/cgi-bin/',
    expires: day + ', 07 Jun ' + year + ' 07:07:07 GMT',
    secure: true,
    domain: 'example.org'
  });
};

// Rewrite domain and path in
// setSecureCookieWithHttpLikeExpirationString to match current test
// domain and directory.
//
// FIXME: remove this once IFRAME puppets and ServiceWorker support
// are implemented in the polyfill
setSecureCookieWithHttpLikeExpirationString =
    eval(String(setSecureCookieWithHttpLikeExpirationString).split(
        '/cgi-bin/').join(location.pathname.replace(/[^/]+$/, '')));
setSecureCookieWithHttpLikeExpirationString =
    eval(String(setSecureCookieWithHttpLikeExpirationString).split(
        'example.org').join(location.hostname));

// Set three simple origin session cookies sequentially and ensure
// they all end up in the cookie jar in order.
let setThreeSimpleOriginSessionCookiesSequentially = async () => {
  await cookieStore.set('__Host-🍪', '🔵cookie-value1🔴');
  await cookieStore.set('__Host-🌟', '🌠cookie-value2🌠');
  await cookieStore.set('__Host-🌱', '🔶cookie-value3🔷');
  // NOTE: this assumes no concurrent writes from elsewhere; it also
  // uses three separate cookie jar read operations where a single getAll
  // would be more efficient, but this way the CookieStore does the filtering
  // for us.
  let matchingValues = await Promise.all([ '🍪', '🌟', '🌱' ].map(
      async ಠ_ಠ => (await cookieStore.get('__Host-' + ಠ_ಠ)).value));
  let actual = matchingValues.join(';');
  let expected = '🔵cookie-value1🔴;🌠cookie-value2🌠;🔶cookie-value3🔷';
  if (actual !== expected) throw new Error(
      'Expected ' + JSON.stringify(expected) +
        ' but got ' + JSON.stringify(actual));
};

// Set three simple origin session cookies in undefined order using
// Promise.all and ensure they all end up in the cookie jar in any
// order.
let setThreeSimpleOriginSessionCookiesNonsequentially = async () => {
  await Promise.all([
    cookieStore.set('__Host-unordered🍪', '🔵unordered-cookie-value1🔴'),
    cookieStore.set('__Host-unordered🌟', '🌠unordered-cookie-value2🌠'),
    cookieStore.set('__Host-unordered🌱', '🔶unordered-cookie-value3🔷')
  ]);
  // NOTE: this assumes no concurrent writes from elsewhere; it also
  // uses three separate cookie jar read operations where a single getAll
  // would be more efficient, but this way the CookieStore does the filtering
  // for us and we do not need to sort.
  let matchingCookies = await Promise.all([ '🍪', '🌟', '🌱' ].map(
      ಠ_ಠ => cookieStore.get('__Host-unordered' + ಠ_ಠ)));
  let actual = matchingCookies.map(({ value }) => value).join(';');
  let expected =
      '🔵unordered-cookie-value1🔴;' +
      '🌠unordered-cookie-value2🌠;' +
      '🔶unordered-cookie-value3🔷';
  if (actual !== expected) throw new Error(
      'Expected ' + JSON.stringify(expected) +
        ' but got ' + JSON.stringify(actual));
};

// Set an already-expired cookie.
let setExpiredSecureCookieWithDomainPathAndFallbackValue = async () => {
  let theVeryRecentPast = Date.now();
  let expiredCookieSentinelValue = 'EXPIRED';
  await cookieStore.set('__Secure-COOKIENAME', expiredCookieSentinelValue, {
    path: '/cgi-bin/',
    expires: theVeryRecentPast,
    secure: true,
    domain: 'example.org'
  });
};

// Rewrite setExpiredSecureCookieWithDomainPathAndFallbackValue to
// match the current domain and path.
//
// FIXME: remove this once IFRAME puppets and ServiceWorker support
// are implemented in the polyfill
setExpiredSecureCookieWithDomainPathAndFallbackValue =
    eval(String(setExpiredSecureCookieWithDomainPathAndFallbackValue).split(
        '/cgi-bin/').join(location.pathname.replace(/[^/]+$/, '')));
setExpiredSecureCookieWithDomainPathAndFallbackValue =
    eval(String(setExpiredSecureCookieWithDomainPathAndFallbackValue).split(
        'example.org').join(location.hostname));

// Delete the __Host-COOKIENAME cookie created above.
let deleteSimpleOriginCookie = async () => {
  await cookieStore.delete('__Host-COOKIENAME');
};

// Delete the __Secure-COOKIENAME cookie created above.
let deleteSecureCookieWithDomainAndPath = async () => {
  await cookieStore.delete('__Secure-COOKIENAME', {
    path: '/cgi-bin/',
    domain: 'example.org',
    secure: true
  });
};

// Rewrite deleteSecureCookieWithDomainAndPath to match the current
// domain and path.
//
// FIXME: remove this once IFRAME puppets and ServiceWorker support
// are implemented in the polyfill
deleteSecureCookieWithDomainAndPath =
    eval(String(deleteSecureCookieWithDomainAndPath).split(
        '/cgi-bin/').join(location.pathname.replace(/[^/]+$/, '')));
deleteSecureCookieWithDomainAndPath =
    eval(String(deleteSecureCookieWithDomainAndPath).split(
        'example.org').join(location.hostname));

// Test for CookieObserver. Used in implementation of async observer-based
// document.cookie simulator. This is passed to the Promise constructor after
// rewriting.
let testObservation_ = (resolve, reject) => {
  // This will get invoked (asynchronously) shortly after the
  // observe(...) call to provide an initial snapshot; in that case
  // the length of cookieChanges may be 0, indicating no matching
  // script-visible cookies for any URL+cookieStore currently
  // observed. The CookieObserver instance is passed as the second
  // parameter to allow additional calls to observe or disconnect.
  let callback = (cookieChanges, observer) => {
    var logEntry = [];
    observationLog.push(logEntry);
    const cookieChangesStrings = changes => changes.map(
        ({type, name, value, index}) => cookieString(Object.assign(
            new Array(observedStore.length),
            {[index]: {
              name: ((type === 'visible') ? '+' : '-') + name,
              value: value
            }})));
    logEntry.push(['before', cookieString(observedStore)]);
    logEntry.push(['changes', cookieChangesStrings(cookieChanges)]);
    const newObservedStore = observedStore.slice(0);
    try {
      const insertions = [], deletions = [];
      cookieChanges.forEach(({
        cookieStore,
        type,
        url,
        name,
        value,
        index,
        all
      }) => {
        switch (type) {
          case 'visible':
            // Creation or modification (e.g. change in value, or
            // removal of HttpOnly), or appearance to script due to
            // change in policy or permissions
            insertions.push([index, {name: name, value: value}]);
            break;
          case 'hidden':
            // Deletion/expiration or disappearance (e.g. due to
            // modification adding HttpOnly), or disappearance from
            // script due to change in policy or permissions
            assert_object_equals(
                {name: name, value: value},
                observedStore[index],
                'Hidden cookie at index ' + index +
                  ' was not the expected one: ' + JSON.stringify({
                    got: {name: name, value: value},
                    expected: observedStore[index]
                  }));
            deletions.push(index);
            break;
          default:
            savedExceptions.push('Unexpected CookieChange type ' + type);
            if (reject) reject(savedExceptions[savedExceptions.length - 1]);
            throw savedExceptions[savedExceptions.length - 1];
        }
      });
      deletions.sort((a, b) => b - a).forEach(
          index => newObservedStore.splice(index, 1));
      let bias = 0;
      insertions.sort(([a], [b]) => a - b).forEach(([ index, cookie ]) => {
        if (newObservedStore[index + bias] !== undefined) {
          newObservedStore.splice(index, 0, cookie);
          --bias;
        } else {
          newObservedStore[index] = cookie;
        }
      });
      observedStore = newObservedStore.filter(entry => entry !== undefined);
      logEntry.push(['after', cookieString(observedStore)]);
      const reported =
            cookieChanges && cookieChanges.length ?
            cookieChanges[cookieChanges.length - 1].all :
            [];
      assert_equals(
          cookieString(reported),
          cookieString(observedStore),
          'Mismatch between observed store and reported store.' +
            '\n observed:\n ' + cookieString(observedStore) +
            '\n reported:\n ' + cookieString(reported) +
            '\n log:\n ' + observationLog.map(JSON.stringify).join('\n '));
    } catch (e) {
      logEntry.push([' *** ⚠ *** ERROR: EXCEPTION THROWN *** ⚠ *** ']);
      savedExceptions.push('Exception in observer');
      savedExceptions.push(e);
      if (reject) reject(e);
      throw e;
    }
    // Resolve promise after first callback
    if (resolve) resolve(observer);
    resolve = null;
    reject = null;
  };
  CookieObserver.startTimer_ = (handler, ignoredDelay) => {
    var timer = {shouldRun: true, fingerPrint: Math.random()};
    new Promise(resolve => s\u0065tTimeout(resolve)).then(() => {
      if (!timer.shouldRun) return;
      CookieObserver.stopTimer_(timer);
      handler();
    });
    return timer;
  };
  CookieObserver.stopTimer_ = timer => {
    timer.shouldRun = false;
  };
  let observer = new CookieObserver(callback);
  // If null or omitted this defaults to location.pathname up to and
  // including the final '/' in a document context, or worker scope up
  // to and including the final '/' in a service worker context.
  let url = (location.pathname).replace(/[^\/]+$/, '');
  // If null or omitted this defaults to interest in all
  // script-visible cookies.
  let interests = [
    // Interested in all secure cookies named '__Secure-COOKIENAME';
    // the default matchType is 'equals' at the given URL.
    { name: '__Secure-COOKIENAME', url: url },
    // Interested in all simple origin cookies named like
    // /^__Host-COOKIEN.*$/ at the default URL.
    { name: '__Host-COOKIEN', matchType: 'startsWith' },
    // Interested in all simple origin cookies named '__Host-🍪'
    // at the default URL.
    { name: '__Host-🍪' },
    // Interested in all cookies named 'OLDCOOKIENAME' at the given URL.
    { name: 'OLDCOOKIENAME', matchType: 'equals', url: url },
    // Interested in all simple origin cookies named like
    // /^__Host-AUTHTOKEN.*$/ at the given URL.
    { name: '__Host-AUTHTOKEN', matchType: 'startsWith', url: url + 'auth/' }
  ];
  observer.observe(cookieStore, interests);
  // Default interest: all script-visible changes, default URL
  observer.observe(cookieStore);
};

// Rewrite testObservation_ to use a path we are allowed to see from a
// document context.
//
// FIXME: remove this once IFRAME puppets and ServiceWorker support
// are implemented in the polyfill
if (kHasDocument) {
  testObservation_ = eval(String(testObservation_).split('auth/').join('auth'));
}

// Wrap testObservation_ to work as a promise.
let testObservation = () => new Promise(testObservation_);

// Verify behavior of no-name and no-value cookies.
let testNoNameAndNoValue = async () => {
  await cookieStore.set('', 'first-value');
  let actual1 =
      (await cookieStore.getAll('')).map(({ value }) => value).join(';');
  let expected1 = 'first-value';
  if (actual1 !== expected1) throw new Error(
      'Expected ' + JSON.stringify(expected1) +
        ' but got ' + JSON.stringify(actual1));
  await cookieStore.set('', '');
  let actual2 =
      (await cookieStore.getAll('')).map(({ value }) => value).join(';');
  let expected2 = '';
  if (actual2 !== expected2) throw new Error(
      'Expected ' + JSON.stringify(expected) +
        ' but got ' + JSON.stringify(actual));
  await cookieStore.delete('');
  assert_equals(
      await getCookieString(),
      undefined,
      'Empty cookie jar after testNoNameAndNoValue');
  if (!kIsStatic) assert_equals(
      await getCookieStringHttp(),
      undefined,
      'Empty HTTP cookie jar after testNoNameAndNoValue');
  if (kHasDocument) assert_equals(
      await getCookieStringDocument(),
      undefined,
      'Empty document.cookie cookie jar after testNoNameAndNoValue');
  if (observer) assert_equals(
      await getCookieStringObserved(),
      undefined,
      'Empty observed cookie jar after testNoNameAndNoValue');
};

// Verify behavior of multiple no-name cookies.
let testNoNameMultipleValues = async () => {
  await cookieStore.set('', 'first-value');
  let actual1 =
      (await cookieStore.getAll('')).map(({ value }) => value).join(';');
  let expected1 = 'first-value';
  if (actual1 !== expected1) throw new Error(
      'Expected ' + JSON.stringify(expected1) +
        ' but got ' + JSON.stringify(actual1));
  await cookieStore.set('', 'second-value');
  let actual2 =
      (await cookieStore.getAll('')).map(({ value }) => value).join(';');
  let expected2 = 'second-value';
  if (actual2 !== expected2) throw new Error(
      'Expected ' + JSON.stringify(expected2) +
        ' but got ' + JSON.stringify(actual2));
  await cookieStore.delete('');
  assert_equals(
      await getCookieString(),
      undefined,
      'Empty cookie jar after testNoNameMultipleValues');
  if (!kIsStatic) assert_equals(
      await getCookieStringHttp(),
      undefined,
      'Empty HTTP cookie jar after testNoNameMultipleValues');
  if (observer) assert_equals(
      await getCookieStringObserved(),
      undefined,
      'Empty observed cookie jar after testNoNameMultipleValues');
};

// Verify that attempting to set a cookie with no name and with '=' in
// the value does not work.
let testNoNameEqualsInValue = async () => {
  await cookieStore.set('', 'first-value');
  let actual1 =
      (await cookieStore.getAll('')).map(({ value }) => value).join(';');
  let expected1 = 'first-value';
  if (actual1 !== expected1) throw new Error(
      'Expected ' + JSON.stringify(expected1) +
        ' but got ' + JSON.stringify(actual1));
  try {
    await cookieStore.set('', 'suspicious-value=resembles-name-and-value');
  } catch (expectedError) {
    let actual2 =
        (await cookieStore.getAll('')).map(({ value }) => value).join(';');
    let expected2 = 'first-value';
    if (actual2 !== expected2) throw new Error(
        'Expected ' + JSON.stringify(expected2) +
          ' but got ' + JSON.stringify(actual2));
    assert_equals(
        await getCookieString(),
        'first-value',
        'Earlier cookie jar after rejected part of testNoNameEqualsInValue');
    await cookieStore.delete('');
    assert_equals(
        await getCookieString(),
        undefined,
        'Empty cookie jar after cleanup in testNoNameEqualsInValue');
    if (!kIsStatic) assert_equals(
        await getCookieStringHttp(),
        undefined,
        'Empty HTTP cookie jar after cleanup in testNoNameEqualsInValue');
    if (observer) assert_equals(
        await getCookieStringObserved(),
        undefined,
        'Empty observed cookie jar after cleanup in testNoNameEqualsInValue');
    return;
  }
  throw new Error(
      'Expected promise rejection' +
        ' when setting a cookie with no name and "=" in value');
};

// When kMetaHttpEquivSetCookieIsGone is set, verify that <meta
// http-equiv="set-cookie" ... > no longer works. Otherwise, verify
// its interoperability with other APIs.
let testMetaHttpEquivSetCookie = async () => {
  await setCookieStringMeta('META-🍪=🔵; path=/');
  if (kMetaHttpEquivSetCookieIsGone) {
    assert_equals(
        await getCookieString(),
        undefined,
        'Empty cookie jar after no-longer-supported' +
          ' <meta http-equiv="set-cookie" ... >');
    if (!kIsStatic) assert_equals(
        await getCookieStringHttp(),
        undefined,
        'Empty HTTP cookie jar after no-longer-supported' +
          ' <meta http-equiv="set-cookie" ... >');
    if (observer) assert_equals(
        await getCookieStringObserved(),
        undefined,
        'Empty observed cookie jar after no-longer-supported' +
          ' <meta http-equiv="set-cookie" ... >');
  } else {
    assert_equals(
        await getCookieString(),
        'META-🍪=🔵',
        'Cookie we wrote using' +
          ' <meta http-equiv="set-cookie" ... > in cookie jar');
    if (!kIsStatic) assert_equals(
        await getCookieStringHttp(),
        'META-🍪=🔵',
        'Cookie we wrote using' +
          ' <meta http-equiv="set-cookie" ... > in HTTP cookie jar');
    if (observer) assert_equals(
        await getCookieStringObserved(),
        'META-🍪=🔵',
        'Cookie we wrote using' +
          ' <meta http-equiv="set-cookie" ... > in observed cookie jar');
    await setCookieStringMeta('META-🍪=DELETED; path=/; max-age=0');
    assert_equals(
        await getCookieString(),
        undefined,
        'Empty cookie jar after <meta http-equiv="set-cookie" ... >' +
          ' cookie-clearing using max-age=0');
    if (!kIsStatic) assert_equals(
        await getCookieStringHttp(),
        undefined,
        'Empty HTTP cookie jar after <meta http-equiv="set-cookie" ... >' +
          ' cookie-clearing using max-age=0');
    if (observer) assert_equals(
        await getCookieStringObserved(),
        undefined,
        'Empty observed cookie jar after <meta http-equiv="set-cookie" ... >' +
          ' cookie-clearing using max-age=0');
  }
};

// Verify interoperability of document.cookie with other APIs.
let testDocumentCookie = async () => {
  await setCookieStringDocument('DOCUMENT-🍪=🔵; path=/');
  assert_equals(
      await getCookieString(),
      'DOCUMENT-🍪=🔵',
      'Cookie we wrote using document.cookie in cookie jar');
  if (!kIsStatic) assert_equals(
      await getCookieStringHttp(),
      'DOCUMENT-🍪=🔵',
      'Cookie we wrote using document.cookie in HTTP cookie jar');
  assert_equals(
      await getCookieStringDocument(),
      'DOCUMENT-🍪=🔵',
      'Cookie we wrote using document.cookie in document.cookie');
  if (observer) assert_equals(
      await getCookieStringObserved(),
      'DOCUMENT-🍪=🔵',
      'Cookie we wrote using document.cookie in observed cookie jar');
  await setCookieStringDocument('DOCUMENT-🍪=DELETED; path=/; max-age=0');
  assert_equals(
      await getCookieString(),
      undefined,
      'Empty cookie jar after document.cookie' +
        ' cookie-clearing using max-age=0');
  if (!kIsStatic) assert_equals(
      await getCookieStringHttp(),
      undefined,
      'Empty HTTP cookie jar after document.cookie' +
        ' cookie-clearing using max-age=0');
  assert_equals(
      await getCookieStringDocument(),
      undefined,
      'Empty document.cookie cookie jar after document.cookie' +
        ' cookie-clearing using max-age=0');
  if (observer) assert_equals(
      await getCookieStringObserved(),
      undefined,
      'Empty observed cookie jar after document.cookie cookie-clearing' +
        ' using max-age=0');
};

// Verify interoperability of HTTP Set-Cookie: with other APIs.
let testHttpCookieAndSetCookieHeaders = async () => {
  await setCookieStringHttp('HTTP-🍪=🔵; path=/');
  assert_equals(
      await getCookieString(),
      'HTTP-🍪=🔵',
      'Cookie we wrote using HTTP in cookie jar');
  assert_equals(
      await getCookieStringHttp(),
      'HTTP-🍪=🔵',
      'Cookie we wrote using HTTP in HTTP cookie jar');
  if (observer) assert_equals(
      await getCookieStringObserved(),
      'HTTP-🍪=🔵',
      'Cookie we wrote using HTTP in observed cookie jar');
  await setCookieStringHttp('HTTP-🍪=DELETED; path=/; max-age=0');
  assert_equals(
      await getCookieString(),
      undefined,
      'Empty cookie jar after HTTP cookie-clearing using max-age=0');
  assert_equals(
      await getCookieStringHttp(),
      undefined,
      'Empty HTTP cookie jar after HTTP cookie-clearing using max-age=0');
  if (observer) assert_equals(
      await getCookieStringObserved(),
      undefined,
      'Empty observed cookie jar after HTTP cookie-clearing' +
        ' using max-age=0');
  await setCookieStringHttp('HTTPONLY-🍪=🔵; path=/; httponly');
  assert_equals(
      await getCookieString(),
      undefined,
      'HttpOnly cookie we wrote using HTTP in cookie jar' +
        ' is invisible to script');
  assert_equals(
      await getCookieStringHttp(),
      'HTTPONLY-🍪=🔵',
      'HttpOnly cookie we wrote using HTTP in HTTP cookie jar');
  if (observer) assert_equals(
      await getCookieStringObserved(),
      undefined,
      'HttpOnly cookie we wrote using HTTP is invisible to observer');
  await setCookieStringHttp(
      'HTTPONLY-🍪=DELETED; path=/; max-age=0; httponly');
  assert_equals(
      await getCookieString(),
      undefined,
      'Empty cookie jar after HTTP cookie-clearing using max-age=0');
  assert_equals(
      await getCookieStringHttp(),
      undefined,
      'Empty HTTP cookie jar after HTTP cookie-clearing using max-age=0');
  if (observer) assert_equals(
      await getCookieStringObserved(),
      undefined,
      'Empty observed cookie jar after HTTP cookie-clearing' +
        ' using max-age=0');
  // TODO: determine why non-UTF-8 byte sequences cause the
  // Set-Cookie to be dropped and determine whether this is
  // always the case.
  await setCookieBinaryHttp(
      unescape(encodeURIComponent('HTTP-🍪=🔵')) + '\xef\xbf\xbd; path=/');
  assert_equals(
      await getCookieString(),
      'HTTP-🍪=🔵\ufffd',
      'Binary cookie we wrote using HTTP in cookie jar');
  assert_equals(
      await getCookieStringHttp(),
      'HTTP-🍪=🔵\ufffd',
      'Binary cookie we wrote using HTTP in HTTP cookie jar');
  assert_equals(
      decodeURIComponent(escape(await getCookieBinaryHttp())),
      'HTTP-🍪=🔵\ufffd',
      'Binary cookie we wrote in binary HTTP cookie jar');
  assert_equals(
      await getCookieBinaryHttp(),
      unescape(encodeURIComponent('HTTP-🍪=🔵')) + '\xef\xbf\xbd',
      'Binary cookie we wrote in binary HTTP cookie jar');
  if (observer) assert_equals(
      await getCookieStringObserved(),
      'HTTP-🍪=🔵\ufffd',
      'Binary cookie we wrote using HTTP in observed cookie jar');
  await setCookieBinaryHttp(
      unescape(encodeURIComponent('HTTP-🍪=DELETED; path=/; max-age=0')));
  assert_equals(
      await getCookieString(),
      undefined,
      'Empty cookie jar after binary HTTP cookie-clearing using max-age=0');
  assert_equals(
      await getCookieStringHttp(),
      undefined,
      'Empty HTTP cookie jar after' +
        ' binary HTTP cookie-clearing using max-age=0');
  assert_equals(
      await getCookieBinaryHttp(),
      undefined,
      'Empty binary HTTP cookie jar after' +
        ' binary HTTP cookie-clearing using max-age=0');
  if (observer) assert_equals(
      await getCookieStringObserved(),
      undefined,
      'Empty observed cookie jar after binary HTTP cookie-clearing' +
        ' using max-age=0');
};

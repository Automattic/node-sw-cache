importScripts( 'serviceworker-cache-polyfill.js' );

/*
 * Variables at this level will survive until the Service Worker is unregistered (or if the script is modified)
 * TODO: find a way to keep the content of `CACHE_BLACKLIST` if the script is updated (localStorage is not available in a ServiceWorker)
 */
var CACHE_PREFIX = 'resource-cache-v',
	CACHE_BLACKLIST = {},
	version = 1;

function getCurrentCacheName() {
	return CACHE_PREFIX + version;
}

self.addEventListener( 'install', function( event ) {
	console.log( 'Installing Service Worker' );
	// immediate takeover of all pages within scope
	// Should avoid the redundant state when script is modified:
	// http://slightlyoff.github.io/ServiceWorker/spec/service_worker/#service-worker-state
	event.waitUntil( self.skipWaiting() );
} );

self.addEventListener( 'activate', function( event ) {
	event.waitUntil(
		Promise.all( [
			// Calling clients.claim() here sets the Service Worker as the controller of the client pages.
			// This allows the pages to start using the Service Worker immediately without reloading.
			// https://developer.mozilla.org/en-US/docs/Web/API/Clients/claim
			self.clients.claim(),
			clearOldCaches()
		] )
	);
} );

self.addEventListener( 'fetch', function( event ) {
	var request = event.request;
	// Do not proxy uncacheable requests or blacklisted urls
	if ( ! canCache( request ) || isBlacklisted( request.url ) ) {
		return;
	}
	event.respondWith( fetchWithCache( event.request ) );
} );

self.addEventListener( 'message', function( event ) {
	var data = event.data || {};
	function respond( err, responseText ) {
		event.ports[0].postMessage( {
			url: data.url,
			responseText: responseText,
			err: err
		} );
	}
	switch ( data.type ) {
		case 'blacklist':
			blacklist( data.urlMatcher );
			break;
		case 'cache url':
			prefetchUrls( data.urls || [ data.url ] );
			break;
		case 'cache clean':
			version++;
			clearOldCaches();
			CACHE_BLACKLIST = {};
			break;
		case 'cache response':
			cacheResponse( new Request( data.url ), new Response( data.responseText ) );
			break;
		case 'get response':
			getResponseFromCache( new Request( data.url ) ).then( function( response ) {
				if ( response ) {
					response.text().then( function( responseText ) {
						respond( null, responseText );
					} );
				} else {
					respond( 'Not Found' );
				}
			} ).catch( respond );
			break;
	}
} );

function fetchWithCache( request ) {
	return getResponseFromCache( request ).then( function( cachedResponse ) {
		// Cache hit, return the response
		if ( cachedResponse ) {
			return cachedResponse;
		}

		// IMPORTANT: Clone the request. A request is a stream and
		// can only be consumed once. Since we are consuming this
		// once by cache and once by the browser for fetch, we need
		// to clone the response
		return fetch( request.clone() ).then( function( response ) {
			// if the response has errored and it is not an opaque response, do not cache
			// Response can be opaque if it is a cross domain request for instance, so we need to cache those
			if ( ! response || ( response.type === 'basic' && response.status !== 200 ) ) {
				return response;
			}

			if ( canCache( request ) ) {
				// IMPORTANT: Clone the response. A response is a stream
				// and because we want the browser to consume the response
				// as well as the cache consuming the response, we need
				// to clone it so we have 2 stream.
				cacheResponse( request, response.clone() );
			}

			return response;
		} );
	} );
}

function getResponseFromCache( request ) {
	return self.caches.match( request );
}

function cacheResponse( request, response ) {
	return self.caches.open( getCurrentCacheName() ).then( function( cache ) {
		cache.put( request, response );
		return response;
	} );
}

function canCache( request ) {
	return 'GET' === request.method;
}

function isBlacklisted( url ) {
	return Object.keys( CACHE_BLACKLIST ).map( function( urlMatcherKey ) {
		return CACHE_BLACKLIST[ urlMatcherKey ].test( url );
	} ).reduce( function( previousValue, currentValue ) {
		return previousValue || currentValue;
	}, false );
}

function blacklist( urlMatcherKey ) {
	var urlMatcher = CACHE_BLACKLIST[ urlMatcherKey ] = new RegExp( urlMatcherKey );
	// clean cache of blacklisted entries
	return self.caches.open( getCurrentCacheName() ).then( function( cache ) {
		cache.keys().then( function( result ) {
			result.forEach( function( request ) {
				if ( urlMatcher.test( request.url ) ) {
					cache.delete( request );
				}
			} );
		} );
	} );
}

function prefetchUrls( urlsToPrefetch ) {
	return self.caches.open( getCurrentCacheName() ).then( function( cache ) {
		return cache.addAll( urlsToPrefetch.map( function( url ) {
			return new Request( url, { mode: 'no-cors' } );
		} ) );
	} );
}

function clearOldCaches() {
	var expectedCacheName = getCurrentCacheName();
	return self.caches.keys().then( function( cacheNames ) {
		return Promise.all(
			cacheNames.map( function( cacheName ) {
				if ( expectedCacheName !== cacheName ) {
					// If this cache name isn't present in the array of "expected" cache names, then delete it.
					console.log( 'Deleting out of date cache:', cacheName );
					return self.caches.delete( cacheName );
				}
			} )
		);
	} );
}

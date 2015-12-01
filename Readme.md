
# Cache Application using a Service Worker

This is a command line tool which launches a proxy to your application and injects a Service Worker into it.
This Service Worker will cache every requests by default.

### Usage:

```
sw-cache --target http://localhost:3000 --proxy https://localhost:3001 --injectClient
```


### From the client

Use the `--injectClient` option or require `sw-cache` from your client app for more fine grained control:

```
var swCacheClient = require( 'sw-cache' );
swCacheClient.load();

// do not cache local requests
swCacheClient.blacklist( 'https://localhost:3001' );

// cache requests manually
swCacheClient.cacheRequest( reqUrl, responseData );

// retrieve a cached request manually
swCacheClient.getCachedResponse( reqUrl ); // returns a Promise
```

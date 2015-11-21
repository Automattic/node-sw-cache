
# Cache Application using a Service Worker

This is a command line tool which launches a proxy to your application and injects a Service Worker into it.
This Service Worker will cache every requests by default.

### Usage:

```
sw-cache --target http://localhost:3000 --proxy https://localhost:3001 --injectClient
```


### From the client

```
var swCacheClient = ( 'sw-cache' );
swCacheClient.load();

// do not cache local requests
swCacheClient.blacklist( 'https://localhost:3001' );

// cache requests manually
swCacheClient.cacheRequest( reqUrl, res );

// retrieve a cached request manually
swCacheClient.getCachedResponse( reqUrl ); // returns a Promise
```

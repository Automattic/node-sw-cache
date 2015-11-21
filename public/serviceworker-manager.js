
( function( root, factory ) {
	if ( typeof define === 'function' && define.amd ) {
		define( [ './serviceworker-loader' ], factory );
	} else if ( typeof module === 'object' && module.exports ) {
		module.exports = factory( require( './serviceworker-loader' ) );
	} else {
		root.serviceWorkerManager = factory( root.serviceWorkerLoader );
	}
}( this, function( swLoader ) {

	var sw;

	function escapeRegExp( str ) {
		return str.replace( /[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, '\\$&' );
	}

	/*
	 * Send a Message to the Service Worker and return a Promise so we can listen on a response if necessary
	 */
	function sendMessage( serviceWorker, message ) {
		return new Promise( function( resolve, reject ) {
			var messageChannel = new MessageChannel();
			messageChannel.port1.onmessage = function( event ) {
				if ( event.data.error ) {
					reject( new Error( event.data.error ) );
				} else {
					resolve( event.data );
				}
			};
			serviceWorker.postMessage( message, [ messageChannel.port2 ] );
		} );
	}

	return {
		load: function() {
			swLoader.load( '/serviceworker.js', function( err, serviceWorker ) {
				if ( err ) {
					console.error( err );
					return;
				}
				sw = serviceWorker;
			} );
		},
		unload: function() {
			swLoader.unload( '/serviceworker.js', function( err, unloaded ) {
				if ( err ) {
					console.error( err );
				}
			} );
		},
		blacklist: function( urlPrefix ) {
			return sendMessage( sw, {
				type: 'blacklist',
				urlMatcher: '^' + escapeRegExp( urlPrefix )
			} );
		},
		cacheRequest: function( requestUrl, response ) {
			return sendMessage( sw, {
				type: 'cache response',
				url: requestUrl,
				responseText: JSON.stringify( response )
			} );
		},
		getCachedResponse: function( requestUrl ) {
			return new Promise( function( resolve, reject ) {
				sendMessage( sw, {
					type: 'get response',
					url: requestUrl
				} ).then( function( result ) {
					resolve( JSON.parse( result.responseText ) );
				} ).catch( function( err ) {
					reject( err );
				} );
			} );
		}
	};

} ) );

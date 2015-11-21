
( function( root, factory ) {
	if ( typeof define === 'function' && define.amd ) {
		define([], factory);
	} else if ( typeof module === 'object' && module.exports ) {
		module.exports = factory();
	} else {
		root.serviceWorkerLoader = factory();
	}
}( this, function( b ) {
	return {
		load: function( file, options, callback ) {
			if ( !callback && typeof options === 'function' ) {
				callback = options;
				options = null;
			}

			if ( ! ( 'serviceWorker' in navigator ) ) {
				callback( new Error( 'Service Worker not supported' ) );
			}

			navigator.serviceWorker.register( file, options ).then( function( registration ) {
				const serviceWorker = registration.installing || registration.waiting || registration.active;
				if ( registration.active ) {
					console.log( 'ServiceWorker ' + file + ' is active.' );
					return callback( null, serviceWorker );
				}
				serviceWorker.addEventListener( 'statechange', function( event ) {
					if ( 'activated' === event.target.state ) {
						console.log( 'ServiceWorker ' + file + ' registered successfully with scope: ', registration.scope );
						callback( null, serviceWorker );
					}
				} );
			} ).catch( callback );
		},
		unload: function( file, options, callback ) {
			var scope;

			if ( !callback && typeof options === 'function' ) {
				callback = options;
				options = null;
			}

			if ( ! ( 'serviceWorker' in navigator ) ) {
				callback( new Error( 'Service Worker not supported' ) );
			}

			scope = options && options.scope || '/';

			navigator.serviceWorker.getRegistration( scope ).then( function( registration ) {
				var serviceWorker;

				if ( !registration ) {
					return callback( null, false );
				}

				serviceWorker = registration.installing || registration.waiting || registration.active;

				// only unregister if it is the same script that was registered for this scope
				if ( serviceWorker && url.resolve( registration.scope, file ) === serviceWorker.scriptURL ) {
					registration.unregister().then( function( result ) {
						if ( result ) {
							console.log( 'ServiceWorker ' + file + ' is unregistered.' );
						}
						callback( null, result );
					} );
				} else {
					callback( null, false );
				}
			} );
		}
	};
} ) );


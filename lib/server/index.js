
var http = require( 'http' );
var https = require( 'https' );
var express = require( 'express' );
var httpProxy = require( 'http-proxy' );
var _ = require( 'lodash' );
var harmon = require( 'harmon' );

/*
 * Returns an instance of net.Server.
 * Serve static files in /public and fallback to the proxy.
 */
module.exports = function( options ) {
	var app = express();
	var server = options.ssl ? https.createServer( options.ssl, app ) : http.createServer( app );
	var proxy = httpProxy.createProxyServer( options );

	app.use( express.static( 'public' ) );

	if( options.injectClient ) {
		app.use( injectHTMLMiddleware( 'head', swScripts() ) );
	}

	app.use( proxy.web.bind( proxy ) );

	// Proxy WebSockets as well
	server.on( 'upgrade', proxy.ws.bind( proxy ) );

	return server;
};

function swScripts() {
	return '\n' + [
		makeTag( {
			tagName: 'script',
			attributes: {
				'src': '/serviceworker-loader.js',
				'type': 'text/javascript'
			}
		} ),
		makeTag( {
			tagName: 'script',
			attributes: {
				'src': '/serviceworker-manager.js',
				'type': 'text/javascript'
			}
		} ),
		makeTag( {
			tagName: 'script',
			textContent: 'serviceWorkerManager.load();'
		} )
	].join( '\n' );
}

function injectHTMLMiddleware( tagName, htmlContent ) {
	var selects = [];

	selects.push( {
		query: tagName,
		func: function( element ) {
			var stream = element.createStream();
			var content = '';
			stream.on( 'data', function( data ) {
				content += data.toString();
			} );
			stream.on( 'end', function() {
				stream.end( content + htmlContent );
			} ) ;
		}
	} );

	return harmon( [], selects, true )
}

function makeTag( options ) {
	var tagName = options.tagName || 'script';
	var attributes = options.attributes || { 'type': 'text/javascript' };
	var scriptHTML = '<' + tagName + ' ';

	scriptHTML += _.map( attributes, function( value, name ) {
		return name + '="' + value + '"';
	} ).join( ' ' );

	scriptHTML += '>';

	if( options.textContent ) {
		scriptHTML += options.textContent;
	}

	scriptHTML += '</' + tagName + '>';

	return scriptHTML;
}
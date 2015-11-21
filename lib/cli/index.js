#!/usr/bin/env node

var os = require( 'os' );
var url = require( 'url' );
var inquirer = require( 'inquirer' );
var CertUtil = require( './cert-util' );
var argv = require( 'yargs' )
	.boolean('injectClient')
	.argv;

function main( callback ) {
	var targetUrl = argv.target,
		proxyUrl = argv.proxy,
		proxyUrlParsed;

	if ( argv.h || argv.help ) {
		return callback( new Error( [
			'Usage:',
			'\tsw-cache --target <target-url> --proxy <proxy-url> [options]',
			'Example:',
			'\tsw-cache --target "http://localhost:3000" --proxy https://localhost:3001 --injectClient'
		].join( '\n' ) ) );
	}

	if ( argv.rm ) {
		CertUtil.rmSSL( argv.rm );
		return callback( );
	}

	if ( argv.ls ) {
		CertUtil.listSSLs( argv.ls );
		return callback( );
	}

	if ( ! proxyUrl ) {
		return callback( new Error( 'proxy url required' ) );
	}

	if ( ! targetUrl ) {
		return callback( new Error( 'target param required for the proxy' ) );
	}

	try {
		proxyUrlParsed = url.parse( proxyUrl );
	} catch( err ) {
		return callback( err );
	}

	if ( 'https:' === proxyUrlParsed.protocol && ! CertUtil.hasSSL( proxyUrlParsed.hostname ) ) {
		inquirer.prompt( [ {
			type: 'confirm',
			name: 'confirm-create',
			message: 'No certificate was found for "' + proxyUrlParsed.hostname + '" in the store, ' +
					'do you want to create a self signed certificate for this hostname and add it to ' +
					( os.platform() === 'darwin' ? 'your system' : 'Chrome' ) + '?',
			default: true
		} ], function( answers ) {
			if ( ! 'confirm-create' in answers ) {
				// Start proxy anyway
				startProxy( proxyUrlParsed, targetUrl );
			}

			// if certificate info was given as a string (Similar to OpenSSL -subj option), generate certificate automatically
			if ( argv.subj ) {
				if ( ! CertUtil.addSSL( argv.subj ) ) {
					return callback();
				}
				startProxy( proxyUrlParsed );
			} else {
				CertUtil.promptSSL( {
					commonName: proxyUrlParsed.hostname
				}, function( err ) {
					if ( err ) return callback( err );
					startProxy( proxyUrlParsed, targetUrl );
				} );
			}
		} );
	} else {
		startProxy( proxyUrlParsed, targetUrl );
	}
}

function startProxy( proxyOptions, target ) {
	var port = argv.port || proxyOptions.port || 8043,
		config = { target: target };

	if ( proxyOptions.protocol === 'https:' ) {
		config.ssl = CertUtil.getSSL( proxyOptions.hostname );
	}
	require( '../server' )( config ).listen( port );
	console.log( 'Proxy server started on port ' + port );
}

main( function( err ) {
	if ( err ) {
		console.error( err.message );
	}
	process.exit( 1 );
} );

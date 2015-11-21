
var os = require( 'os' );
var fs = require( 'fs' );
var path = require( 'path' );
var _ = require( 'lodash' );
var forge = require( 'node-forge' );
var inquirer = require( 'inquirer' );
var shell = require( 'shelljs' );

var CertUtil = module.exports = {};

CertUtil.path = path.resolve( __dirname, '..', '..', 'certificates' );

CertUtil.hasSSL = function( hostname ) {
	return fs.existsSync( path.join( CertUtil.path, hostname + '.key' ) ) &&
		fs.existsSync( path.join( CertUtil.path, hostname + '.crt' ) );
};

CertUtil.getSSL = function( hostname ) {
	return {
		cert: fs.readFileSync( path.join( CertUtil.path, hostname + '.crt' ), 'utf8' ),
		key: fs.readFileSync( path.join( CertUtil.path, hostname + '.key' ), 'utf8' )
	}
};

CertUtil.addSSL = function( certInfo, keys ) {
	var hostname = certInfo.commonName || 'localhost';
	return CertUtil.registerSSL( hostname, CertUtil.createSSL( certInfo, keys ) );
};

CertUtil.registerSSL = function( hostname, ssl ) {
	var certPath = path.join( CertUtil.path, hostname + '.crt' );
	var keyPath = path.join( CertUtil.path, hostname + '.key' );
	fs.writeFileSync( certPath, ssl.cert );
	fs.writeFileSync( keyPath, ssl.key );
	if ( os.platform() === 'darwin' ) {
		console.log( [
			'Run the following command and restart:',
			'sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain ' + certPath
		].join( '\n' ) );
		return false;
	} else {
		if ( ! shell.which( 'certutil' ) ) {
			console.log( [
				'Cannot find command "certutil" needed to add the certificate to the NSS Shared DB (for Chrome).',
				'For Debian/Ubuntu, run the following command and restart:',
				'\tsudo apt-get install libnss3-tools',
				'',
				'For other Linux distributions, see: https://chromium.googlesource.com/chromium/src/+/master/docs/linux_cert_management.md'
			].join( '\n' ) );
			return false;
		}
		console.log( 'Adding certificate to the NSS shared DB...' );
		shell.exec( 'certutil -d sql:$HOME/.pki/nssdb -A -t "P,," -n ' + hostname + ' -i ' + certPath );
		CertUtil.listSSLs();
		console.log( 'Restart Chrome!' );
	}
	return true;
};

CertUtil.rmSSL = CertUtil.unregisterSSL = function( hostname ) {
	var certPath = path.join( CertUtil.path, hostname + '.crt' );
	var keyPath = path.join( CertUtil.path, hostname + '.key' );
	try {
		fs.unlinkSync( certPath );
		fs.unlinkSync( keyPath );
	} catch( err ) {
		console.error( err.message );
	}
	shell.exec( 'certutil -d sql:$HOME/.pki/nssdb -D -n ' + hostname );
};

CertUtil.listSSLs = function( ) {
	console.log( 'List of certificates in the NSS shared DB:' );
	shell.exec( 'certutil -d sql:$HOME/.pki/nssdb -L' );
};

function parseSubject( subjectString ) {
	return subjectString.split( '/' ).reduce( function( result, part ) {
		var pair = part.split( '=' );
		if ( 2 === pair.length ) {
			result[ pair[0] ] = pair[1];
		}
		return result;
	}, {} );
}

CertUtil.createSSL = function( certInfo, keys ) {
	var pki = forge.pki;
	var cert = pki.createCertificate();
	var attributes;

	if ( 'string' === typeof certInfo ) {
		certInfo = parseSubject( certInfo );
	}

	// shortcodes: https://github.com/digitalbazaar/forge/blob/master/js/x509.js#L121
	attributes = _.map( certInfo, function( value, name ) {
		var isShortCode = name[0] === name[0].toUpperCase();
		if ( isShortCode ) {
			return {
				shortName: name,
				value: value
			}
		} else {
			return {
				name: name,
				value: value
			};
		}
	} );

	// generate a keypair and create an X.509v3 certificate
	keys = keys || pki.rsa.generateKeyPair( 2048 );

	cert.publicKey = keys.publicKey;
	cert.serialNumber = '01';
	cert.validity.notBefore = new Date();
	cert.validity.notAfter = new Date();
	cert.validity.notAfter.setFullYear( cert.validity.notBefore.getFullYear() + 1 );

	cert.setSubject( attributes );
	cert.setIssuer( attributes );

	cert.setExtensions( [
		{
			name: 'basicConstraints',
			cA: false
		},
		{
			name: 'subjectKeyIdentifier'
		}
	] );

	// self-sign certificate
	cert.sign( keys.privateKey );

	return {
		cert: pki.certificateToPem( cert ), // convert a Forge certificate to PEM
		key: pki.privateKeyToPem( keys.privateKey )
	};
};

CertUtil.createCSR = function( certInfo, keys ) {
	// create a certification request (CSR)
	var csr = forge.pki.createCertificationRequest();

	// shortcodes: https://github.com/digitalbazaar/forge/blob/master/js/x509.js#L121
	var attributes = _.map( certInfo, function( value, name ) {
		var isShortCode = name[0] === name[0].toUpperCase();
		if ( isShortCode ) {
			return {
				shortName: name,
				value: value
			}
		} else {
			return {
				name: name,
				value: value
			};
		}
	} );

	csr.publicKey = keys.publicKey;
	csr.setSubject( attributes );

	// sign certification request
	csr.sign( keys.privateKey );

	return csr;
};

CertUtil.createFromCSR = function( pem, privateKey ) {
	var csr = forge.pki.certificationRequestFromPem( pem );
	return CertUtil.create( csr.subject.attributes, {
		publicKey: csr.publicKey,
		privateKey: privateKey
	} );
};

CertUtil.promptSSL = function( certInfo, callback ) {
	if ( 'function' === typeof certInfo ) {
		callback = certInfo;
		certInfo = {};
	}
	inquirer.prompt( [
		{
			type: 'input',
			name: 'commonName',
			message: 'Common Name ?',
			default: certInfo.commonName || 'localhost'
		},
		{
			type: 'input',
			name: 'countryName',
			message: 'Country Name ?',
			default: certInfo.countryName || 'US'
		},
		{
			type: 'input',
			name: 'stateOrProvinceName',
			message: 'State or Province Name ?',
			default: certInfo.stateOrProvinceName || 'Virginia'
		},
		{
			type: 'input',
			name: 'localityName',
			message: 'Locality Name ?',
			default: certInfo.localityName || 'Blacksburg'
		},
		{
			type: 'input',
			name: 'organizationName',
			message: 'Organization Name ?',
			default: certInfo.organizationName || 'Test'
		},
		{
			type: 'input',
			name: 'organizationalUnitName',
			message: 'Organizational Unit Name ?',
			default: certInfo.organizationalUnitName || 'Test'
		}
	], function( answers ) {
		CertUtil.addSSL( answers );
		callback();
	} );
};

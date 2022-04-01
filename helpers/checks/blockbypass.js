'use strict';

const { Bypass } = require(__dirname+'/../../db/')
	, { ObjectId } = require(__dirname+'/../../db/db.js')
	, config = require(__dirname+'/../../config.js')
	, deleteTempFiles = require(__dirname+'/../files/deletetempfiles.js')
	, dynamicResponse = require(__dirname+'/../dynamic.js')
	, production = process.env.NODE_ENV === 'production';

module.exports = {

	check: async (req, res, next) => {
		const { secureCookies, blockBypass } = config.get;

		//check if blockbypass exists and right length
		const bypassId = req.signedCookies.bypassid;
		if (!res.locals.solvedCaptcha && (!bypassId || bypassId.length !== 24)) {
			deleteTempFiles(req).catch(e => console.error);
			return dynamicResponse(req, res, 403, 'message', {
				'title': 'Proibido',
				'message': 'Por favor completa um bypass para continuar',
				'frame': '/bypass_minimal.html',
				'link': {
					'href': '/bypass.html',
					'text': 'Adquirir bypass',
				},
			});
		}

		//try to get bypass from db and make sure uses < maxUses
		let bypass;
		if (bypassId && bypassId.length === 24) {
			try {
				const bypassMongoId = ObjectId(bypassId);
				bypass = await Bypass.checkBypass(bypassMongoId, res.locals.anonymizer);
				res.locals.blockBypass = true;
			} catch (err) {
				return next(err);
			}
		}

		if (bypass //if they have a valid bypass
			&& (bypass.uses < blockBypass.expireAfterUses //and its not overused
				|| (res.locals.anonymizer
					&& !blockBypass.forceAnonymizers))) { //OR its not forced for anonymizers
			return next();
		}

		if (res.locals.solvedCaptcha) {
			//they dont have a valid bypass, but just solved board captcha, so give them a new one
			const newBypass = await Bypass.getBypass(res.locals.anonymizer);
			const newBypassId = newBypass.insertedId;
			res.locals.blockBypass = true;
			res.cookie('bypassid', newBypassId.toString(), {
				'maxAge': blockBypass.expireAfterTime,
				'secure': production && secureCookies && (req.headers['x-forwarded-proto'] === 'https'),
				'sameSite': 'strict',
				'signed': true
			});
			return next();
		}

		deleteTempFiles(req).catch(e => console.error);
		return dynamicResponse(req, res, 403, 'message', {
			'title': 'Proibido',
			'message': 'Bypass expirou ou excedeu o número de usos',
			'frame': '/bypass_minimal.html',
			'link': {
				'href': '/bypass.html',
				'text': 'Adquirir bypass',
			},
		});

	},

	middleware: async (req, res, next) => {
		const { blockBypass } = config.get;
		if (res.locals.preFetchedBypassId //if they already have a bypass
			|| (!blockBypass.enabled //or if block bypass isnt enabled
				&& (!blockBypass.forceAnonymizers //and we dont force it for anonymizer
				|| !res.locals.anonymizer))) { //or they arent on an anonymizer
			return next();
		}
		return module.exports.check(req, res, next);
	},

}

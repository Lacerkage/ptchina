'use strict';

const { getInsecureTrip, getSecureTrip } = require(__dirname+'/tripcode.js')
	, nameRegex = /^(?<name>(?!##|#).*?)?(?:(?<secure>##|#)(?<tripcode>[^# ].+?))?(?<capcode>##(?<capcodetext> .*?)?)?$/
	, staffLevels = ['Admin', 'Global Staff', 'Board Owner', 'Board Mod']
	, staffLevelsRegex = new RegExp(`(${staffLevels.join('|')})+`, 'igm')

module.exports = async (inputName, permLevel, boardSettings, boardOwner, username) => {

	const { forceAnon, defaultName, moderators } = boardSettings;
	const isBoardOwner = username === boardOwner;
	const isBoardMod = moderators.includes(username);

	let name = defaultName;
	let tripcode = null;
	let capcode = null;
	if ((permLevel < 4 || !forceAnon) && inputName && inputName.length > 0) {
		// get matches with named groups for name, trip and capcode in 1 regex
		const matches = inputName.match(nameRegex);
console.log(matches, matches.groups)
		if (matches && matches.groups) {
			const groups = matches.groups;
			//name
			if (groups.name) {
				name = groups.name;
			}
			//tripcode
			if (groups.tripcode) {
				if (groups.secure.length === 1) {
					tripcode = `!${getInsecureTrip(groups.tripcode)}`;
				} else {
					tripcode = `!!${(await getSecureTrip(groups.tripcode))}`;
				}
			}
			//capcode
			if (permLevel < 4 && groups.capcode) {
				let capcodeInput = groups.capcodetext ? groups.capcodetext.trim() : '';
				//by default, use board staff if ismod/owner, else use higher staff
				let staffLevel = staffLevels.find((sl, l) => capcodeInput.toLowerCase().startsWith(sl.toLowerCase()) && l === permLevel)
					|| (isBoardOwner ? staffLevels[2]
					: isBoardMod ? staffLevels[3]
					: staffLevels[permLevel]); //kill me
				capcode = staffLevel;
				if (capcodeInput && capcodeInput.toLowerCase() !== staffLevel.toLowerCase()) {
					capcode = `${staffLevel} ${capcodeInput.replace(staffLevelsRegex, '').trim()}`;
				}
				capcode = `## ${capcode}`;
			}
		}
	}

	return { name, tripcode, capcode };

}

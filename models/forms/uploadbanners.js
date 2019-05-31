'use strict';

const path = require('path')
	, { remove, pathExists, ensureDir } = require('fs-extra')
	, uploadDirectory = require(__dirname+'/../../helpers/uploadDirectory.js')
	, imageUpload = require(__dirname+'/../../helpers/files/imageupload.js')
	, fileCheckMimeType = require(__dirname+'/../../helpers/files/file-check-mime-types.js')
	, imageIdentify = require(__dirname+'/../../helpers/files/image-identify.js')
	, deleteTempFiles = require(__dirname+'/../../helpers/files/deletetempfiles.js')
	, Boards = require(__dirname+'/../../db/boards.js')

module.exports = async (req, res, next, numFiles) => {

	const redirect = `/${req.params.board}/manage.html`

	// check all mime types befoer we try saving anything
	for (let i = 0; i < numFiles; i++) {
		if (!fileCheckMimeType(req.files.file[i].mimetype, {image: true, animatedImage: true, video: false})) {
			await deleteTempFiles(req.files.file)
			return res.status(400).render('message', {
				'title': 'Bad request',
				'message': `Invalid file type for ${req.files.file[i].name}. Mimetype ${req.files.file[i].mimetype} not allowed.`,
				'redirect': redirect
			});
		}
	}

	const filenames = [];
	for (let i = 0; i < numFiles; i++) {
		const file = req.files.file[i];
		const filename = file.sha256 + path.extname(file.name);
		file.filename = filename;

		//check if already exists
		const exists = await pathExists(`${uploadDirectory}banner/${req.params.board}/${filename}`);

		if (exists) {
			await remove(file.tempFilePath);
			continue;
/* dont stop uploading the other banners just because one already exists.
			return res.status(409).render('message', {
				'title': 'Conflict',
				'message': `Invalid file ${file.name}. Banner already exists.`,
				'redirect': redirect
			});
*/
		}

		//add to list after checking it doesnt already exist
		filenames.push(filename);

		//make directory if doesnt exist
		await ensureDir(`${uploadDirectory}banner/${req.params.board}/`);

		//get metadata from tempfile
		const imageData = await imageIdentify(req.files.file[i].tempFilePath, null, true);
		let geometry = imageData.size;
		if (Array.isArray(geometry)) {
			geometry = geometry[0];
		}

		//make sure its 300x100 banner
		if (geometry.width !== 300 || geometry.height !== 100) {
			await deleteTempFiles(req.files.file);
			return res.status(400).render('message', {
				'title': 'Bad request',
				'message': `Invalid file ${file.name}. Banners must be 300x100.`,
				'redirect': redirect
			});
		}

		//then upload it
		await imageUpload(file, filename, `banner/${req.params.board}`);

		//and delete the temp file
		await remove(file.tempFilePath);

	}

	await Boards.addBanners(req.params.board, filenames);
//TODO: banners pages
//	await buildBanners(res.locals.board);

	return res.render('message', {
		'title': 'Success',
		'message': `Uploaded ${filenames.length} new banners.`,
		'redirect': redirect
	});

}

const exec = require('child_process').exec,
	fs = require('fs');

const gulp = require('gulp');

const git = require('gulp-git'),
	gitStatus = require('git-get-status'),
	jasmine = require('gulp-jasmine'),
	jshint = require('gulp-jshint'),
	prompt = require('gulp-prompt'),
	replace = require('gulp-replace');

function getVersionFromPackage() {
	return JSON.parse(fs.readFileSync('./package.json', 'utf8')).version;
}

function getGitHubLink() {
	const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
	
	const link = pkg.homepage.replace(/#.*/g, '');

	return `Project GitHub: ${link}`;
}

gulp.task('ensure-clean-working-directory', (cb) => {
	gitStatus((err, status) => {
		if ((err, !status.clean)) {
			throw new Error('Unable to proceed, your working directory is not clean.');
		}

		cb();
	});
});

gulp.task('bump-choice', (cb) => {
	const processor = prompt.prompt(
		{
			type: 'list',
			name: 'bump',
			message: `What type of bump would you like to do? (Current: ${getVersionFromPackage()})`,
			choices: ['patch', 'minor', 'major']
		},
		(res) => {
			global.bump = res.bump;

			return cb();
		}
	);

	return gulp.src(['./package.json']).pipe(processor);
});

gulp.task('bump-version', (cb) => {
	exec(
		`npm version ${global.bump || 'patch'} --no-git-tag-version`,
		{
			cwd: './'
		},
		(error) => {
			if (error) {
				cb(error);
			}

			cb();
		}
	);
});

gulp.task('embed-version', () => {
	const version = getVersionFromPackage();

	return gulp.src(['./docs/_coverpage.md'])
		.pipe(replace(/[0-9]+\.[0-9]+\.[0-9]+/g, version))
		.pipe(gulp.dest('./docs/'));
});

gulp.task('commit-changes', () => {
	return gulp
		.src(['./', './package.json', './package-lock.json', './docs/_coverpage.md'])
		.pipe(git.add())
		.pipe(git.commit('Release. Bump version number'));
});

gulp.task('push-changes', (cb) => {
	git.push('origin', 'master', cb);
});

gulp.task('create-tag', (cb) => {
	const version = getVersionFromPackage();

	git.tag(version, 'Release ' + version, (error) => {
		if (error) {
			return cb(error);
		}

		git.push('origin', 'master', { args: '--tags' }, cb);
	});
});

gulp.task('execute-tests', () => {
	return gulp.src(['test/specs/**/*.js']).pipe(jasmine());
});

gulp.task('print-github', () => {
	return Promise.resolve().then(() => {
		console.info(getGitHubLink());
	});
});

gulp.task('release', gulp.series(
	'ensure-clean-working-directory',
	'execute-tests',
	'bump-choice',
	'bump-version',
	'embed-version',
	'commit-changes',
	'push-changes',
	'create-tag',
	'print-github'
));

gulp.task('lint', () => {
	return gulp
		.src(['./bin/**/*.js', './lib/**/*.js', './test/specs/**/*.js', './gulpfile.js'])
		.pipe(jshint({ esversion: 9 }))
		.pipe(jshint.reporter('default'))
		.pipe(jshint.reporter('fail'));
});

gulp.task('test', gulp.series('execute-tests'));

gulp.task('default', gulp.series('lint'));

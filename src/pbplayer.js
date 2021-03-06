pbPlayer = PB.Class(PB.Observer, {

	/**
	 * Constructs the pbPlayer.
	 *
	 * @param {String|DOMElement|PB.$} The DOM node reference for the player to attach to, can be a selector, DOM Node or PB.$.
	 * @param {Object} Options for the pbPlayer, various stuff can be set here.
	 */
	construct: function ( element, options ) {

		if( !(this instanceof pbPlayer) ) {

			return new pbPlayer(element, options);
		}

		// Initialize Observer
		this.parent();

		if( !options ) {

			options = element;
			element = null;
		}

		this.options = PB.overwrite({}, pbPlayer.defaults);
		PB.overwrite(this.options, options);

		this.playlist = new Playlist(this);
		this.mediaContainer = null;
		this.skin = null;	// Set when element is true

		registerPlayerInstance(this);

		this._playerData = {

			volume: this.options.volume,
			time: 0,
			duration: 0,
			playState: pbPlayer.PLAYSTATE_STOPPED
		};
	},

	/**
	 * Destroys the pbPlayer instance.
	 */
	destroy: function () {

		// Destroy media container
		if( this.mediaContainer ) {

			this.mediaContainer.destroy();
			this.mediaContainer = null;
		}

		// Destroy skin
		if( this.skin ) {

			this.skin.destroy();
			this.skin = null;
		}

		// Remove from group
		unregisterPlayerInstance(this);
	},

	/**
	 * Adds media to playlist.
	 */
	addMedia: function ( media ) {

		this.playlist.add(media);

		// TODO: Move this to HTML5 container since this behaviour
		// is exclusive to the audio element and not other solutions.
		// Autoplay, does not work on some mobile/handheld devices
		if( this.options.autoplay && this.playlist.size() >= 1 && !/(iPod|iPad|iPhone).*AppleWebKit/.test(window.navigator.userAgent) ) {

			this.play();
		}
	},

	/**
	 * Removes media from playlist.
	 */
	removeMedia: function ( media ) {

		this.playlist.remove(media);
	},

	/**
	 * Removes all media from the playlist.
	 */
	emptyMedia: function() {

		this.destroyCurrentMediaContainer();

		this.playlist.empty();
	},

	/**
	 * Gets the right media container for a media object.
	 */
	getMediaContainer: function () {

		var media,
			solutions = this.options.solution.replace(',', '').split(' '),
			solution,
			mediaContainer,
			i = 0;

		// Already matched a container
		if( this.mediaContainer ) {

			return true;
		}

		media = this.playlist.getCurrent();

		if( !media ) {

			this.emit('error', {

				//code: this.element.error,
				message: 'No media given'
			});

			return false;
		}

		for( ; i < solutions.length; i++ ) {

			solution = solutions[i];
			mediaContainer = pbPlayer.mediaContainers[solution];

			if( !mediaContainer ) {

				this.emit('error', {

					message: 'Media container `'+solution+'` not found'
				});
				continue;
			}

			// Find suitable media container
			PB.each(media, function ( codec, url ) {

				if( mediaContainer.canPlayType(codec) ) {

					this.mediaContainer = new mediaContainer(this, url, media);

					// Stop loop
					return true;
				}
			}, this);

			if( this.mediaContainer ) {

				break;
			}
		}

		// No media container found
		if( !this.mediaContainer ) {

			this.emit('error', {

				message: 'No suitable media container found',
				media: media
			});
		}

		return !!this.mediaContainer;
	},

	/**
	 * Destoy current media container
	 */
	destroyCurrentMediaContainer: function () {

		if( this.mediaContainer ) {

			this.mediaContainer.destroy();
			this.mediaContainer = null;
		}

		// Todo, reset duration/time/playstate/..
		this._playerData.playstate = pbPlayer.PLAYSTATE_STOPPED;

		this.emit('duration', {

			length: 0
		});

		this.emit('timeupdate', {

			position: 0,
			progress: 0
		});
	},

	/**
	 * Event normalisation
	 *
	 * Add type and target to event object
	 */
	emit: function ( type, data ) {

		// Event object
		var eventObject = {

			type: type,
			target: this
		};

		PB.overwrite(eventObject, data);

		// Debug
		if( this.options.debug ) {

			PB.log('Event triggered: ', type, eventObject);
		}

		switch ( type ) {

			case 'volumechange':
				this._playerData.volume = data.volume;
				break;

			case 'timeupdate':
				this._playerData.time = data.position;
				break;

			case 'duration':
				this._playerData.duration = data.length;
				break;

			case 'play':
				this._playerData.playState = pbPlayer.PLAYSTATE_PLAYING;
				break;

			case 'pause':
				this._playerData.playState = pbPlayer.PLAYSTATE_PAUSED;
				break;

			case 'stop':
				this._playerData.playState = pbPlayer.PLAYSTATE_STOPPED;
				break;
		}

		this.parent(type, eventObject);
	},

	/**
	 * Goto next entry in playlist
	 */
	next: function () {

		this.destroyCurrentMediaContainer();

		if( this.playlist.next() ) {

			this.play();
		}
	},

	/**
	 * Goto previous entry in playlist
	 */
	previous: function () {

		this.destroyCurrentMediaContainer();

		if( this.playlist.previous() ) {

			this.play();
		}
	},

	/**
	 * Return player state
	 */
	getPlayState: function () {

		switch ( this._playerData.playState ) {

			case pbPlayer.PLAYSTATE_PLAYING:
				return 'playing';

			case pbPlayer.PLAYSTATE_PAUSED:
				return 'paused';

			case pbPlayer.PLAYSTATE_STOPPED:
				return 'stopped';
		}
	},

	/**
	 * Sets the volume of the player, values between 0 and 100 are valid.
	 *
	 * @param {Number} between 0 and 100
	 */
	setVolume: function( volume ) {

		if( !this.getMediaContainer() ) {

			return this;
		}

		volume = parseInt(volume, 10);
		volume = ( volume < 0 ) ? 0 : ( volume > 100 ) ? 100 : volume;

		this.mediaContainer.setVolume(value);
	},

	getVolume: function () {

		return this._playerData.volume;
	},

	getDuration: function () {

		return this._playerData.duration;
	},

	getTime: function () {

		return this._playerData.time;
	},

	/*isBuffering: function () {

	},*/

	isPlaying: function () {

		return this._playerData.playState === pbPlayer.PLAYSTATE_PLAYING;
	},

	isPaused: function () {

		return this._playerData.playState === pbPlayer.PLAYSTATE_PAUSED;
	},

	isStopped: function () {

		return this._playerData.playState === pbPlayer.PLAYSTATE_STOPPED;
	}
});

var proxyPlayerControlls = 'play pause stop playAt setVolume mute unmute'.split(' '),
	i = proxyPlayerControlls.length;

PB.each(proxyPlayerControlls, function ( key, value ) {

	pbPlayer.prototype[value] = function () {

		if( !this.getMediaContainer() ) {

			return this;
		}

		this.mediaContainer[value].apply(this.mediaContainer, PB.toArray(arguments));
	};
});

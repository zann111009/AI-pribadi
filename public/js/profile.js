const PROFILE_KEY = 'ai-pribadi-profile';
const PROFILE_MAX_DIM = 256;
const PROFILE_MAX_FILE = 5 * 1024 * 1024;
const PROFILE_NAME_MAX = 32;

class ProfileManager {
  constructor() {
    this.profile = { username: '', photo: '' };
    this.pendingPhoto = '';

    this.els = {
      profileToggle: document.getElementById('sidebarProfileBtn'),
      profileTogglePhoto: document.getElementById('sidebarProfilePhoto'),
      profileToggleIcon: document.getElementById('sidebarProfileIcon'),
      profileModal: document.getElementById('profileModal'),
      profileOverlay: document.getElementById('profileOverlay'),
      profileClose: document.getElementById('profileClose'),
      profilePhoto: document.getElementById('profilePhoto'),
      profilePhotoPreview: document.getElementById('profilePhotoPreview'),
      profilePhotoIcon: document.getElementById('profilePhotoIcon'),
      profilePhotoInput: document.getElementById('profilePhotoInput'),
      profilePickPhoto: document.getElementById('profilePickPhoto'),
      profileRemovePhoto: document.getElementById('profileRemovePhoto'),
      profileUsername: document.getElementById('profileUsername'),
      profileSave: document.getElementById('profileSave'),
      profileStatus: document.getElementById('profileStatus'),
    };

    this.load();
    this.setupEventListeners();
    this.render();
  }

  load() {
    try {
      const raw = localStorage.getItem(PROFILE_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed && typeof parsed === 'object') {
        this.profile = {
          username: typeof parsed.username === 'string' ? parsed.username.slice(0, PROFILE_NAME_MAX) : '',
          photo: typeof parsed.photo === 'string' ? parsed.photo : '',
        };
      }
    } catch (e) {
      this.profile = { username: '', photo: '' };
    }
  }

  save() {
    try {
      localStorage.setItem(PROFILE_KEY, JSON.stringify(this.profile));
    } catch (e) {
      this.setStatus('Gagal menyimpan profil (penyimpanan penuh).');
      return false;
    }
    return true;
  }

  getUserName() {
    return this.profile.username;
  }

  getPhoto() {
    return this.profile.photo;
  }

  hasProfile() {
    return Boolean(this.profile.username || this.profile.photo);
  }

  setupEventListeners() {
    const {
      profileToggle, profileModal, profileOverlay, profileClose,
      profilePhoto, profilePhotoInput, profilePickPhoto, profileRemovePhoto,
      profileUsername, profileSave,
    } = this.els;

    if (profileToggle) {
      profileToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        this.open();
      });
    }

    if (profileOverlay) {
      profileOverlay.addEventListener('click', () => this.close());
    }

    if (profileClose) {
      profileClose.addEventListener('click', () => this.close());
    }

    if (profilePickPhoto) {
      profilePickPhoto.addEventListener('click', () => profilePhotoInput && profilePhotoInput.click());
    }

    if (profilePhoto) {
      profilePhoto.addEventListener('click', () => profilePhotoInput && profilePhotoInput.click());
    }

    if (profilePhotoInput) {
      profilePhotoInput.addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        e.target.value = '';
        if (file) this.handleFile(file);
      });
    }

    if (profileRemovePhoto) {
      profileRemovePhoto.addEventListener('click', () => {
        this.pendingPhoto = '';
        this.renderPhoto(this.pendingPhoto);
      });
    }

    if (profileUsername) {
      profileUsername.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.commit();
        }
      });
    }

    if (profileSave) {
      profileSave.addEventListener('click', () => this.commit());
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen()) this.close();
    });
  }

  isOpen() {
    return Boolean(this.els.profileModal && this.els.profileModal.classList.contains('open'));
  }

  open() {
    if (!this.els.profileModal) return;
    this.pendingPhoto = this.profile.photo;
    if (this.els.profileUsername) {
      this.els.profileUsername.value = this.profile.username;
    }
    this.renderPhoto(this.pendingPhoto);
    this.setStatus('');
    this.els.profileModal.classList.add('open');
    this.els.profileOverlay.classList.add('open');
    document.body.classList.add('body-menu-open');
    if (this.els.profileUsername) this.els.profileUsername.focus();
  }

  close() {
    if (!this.els.profileModal) return;
    this.els.profileModal.classList.remove('open');
    this.els.profileOverlay.classList.remove('open');
    document.body.classList.remove('body-menu-open');
  }

  commit() {
    const name = (this.els.profileUsername?.value || '').trim().slice(0, PROFILE_NAME_MAX);
    this.profile = { username: name, photo: this.pendingPhoto };

    if (!this.save()) return;

    this.render();
    this.setStatus('Profil tersimpan.');
    setTimeout(() => {
      if (this.isOpen()) this.close();
    }, 600);
  }

  setStatus(message) {
    if (!this.els.profileStatus) return;
    this.els.profileStatus.textContent = message || '';
    this.els.profileStatus.classList.toggle('is-visible', Boolean(message));
  }

  renderPhoto(photo) {
    const { profilePhotoPreview, profilePhotoIcon, profileRemovePhoto } = this.els;

    if (profilePhotoPreview) {
      profilePhotoPreview.classList.toggle('is-hidden', !photo);
      if (photo) profilePhotoPreview.src = photo;
    }
    if (profilePhotoIcon) {
      profilePhotoIcon.classList.toggle('is-hidden', Boolean(photo));
    }
    if (profileRemovePhoto) {
      profileRemovePhoto.classList.toggle('is-hidden', !photo);
    }
  }

  render() {
    const { profileTogglePhoto, profileToggleIcon } = this.els;
    const photo = this.profile.photo;

    if (profileTogglePhoto) {
      profileTogglePhoto.classList.toggle('is-hidden', !photo);
      if (photo) profileTogglePhoto.src = photo;
    }
    if (profileToggleIcon) {
      profileToggleIcon.classList.toggle('is-hidden', Boolean(photo));
    }

    if (this.els.profileToggle) {
      this.els.profileToggle.title = this.profile.username
        ? `Profil: ${this.profile.username}`
        : 'Profil pengguna';
      this.els.profileToggle.setAttribute('aria-label', this.els.profileToggle.title);
    }

    this.renderPhoto(photo);
    this.syncAvatars(photo);
  }

  syncAvatars(photo) {
    document.querySelectorAll('.avatar-user').forEach((el) => {
      if (photo) {
        el.style.backgroundImage = `url("${photo}")`;
        el.classList.add('has-photo');
      } else {
        el.style.backgroundImage = '';
        el.classList.remove('has-photo');
      }
    });

    const username = this.profile.username;
    document.querySelectorAll('.bubble-username').forEach((el) => {
      if (username) {
        el.textContent = username;
      } else {
        el.remove();
      }
    });
  }

  async handleFile(file) {
    if (!file.type || !file.type.startsWith('image/')) {
      this.setStatus('File harus berupa gambar (JPG/PNG).');
      return;
    }
    if (file.size > PROFILE_MAX_FILE) {
      this.setStatus('Ukuran file maksimal 5MB.');
      return;
    }

    try {
      const dataUrl = await this.resizeImage(file);
      this.pendingPhoto = dataUrl;
      this.renderPhoto(this.pendingPhoto);
      this.setStatus('Foto siap. Klik Simpan Profil.');
    } catch (err) {
      console.error('[Profile] gagal memproses foto:', err);
      this.setStatus('Gagal memproses foto, coba gambar lain.');
    }
  }

  resizeImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        const img = new Image();

        img.onload = () => {
          const w = img.naturalWidth || img.width;
          const h = img.naturalHeight || img.height;
          if (!w || !h) {
            reject(new Error('Dimensi gambar tidak valid'));
            return;
          }

          const scale = Math.min(1, PROFILE_MAX_DIM / Math.max(w, h));
          const width = Math.max(1, Math.round(w * scale));
          const height = Math.max(1, Math.round(h * scale));

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);

          resolve(canvas.toDataURL('image/jpeg', 0.85));
        };

        img.onerror = () => reject(new Error('Gagal memuat gambar'));
        img.src = reader.result;
      };

      reader.onerror = () => reject(new Error('Gagal membaca file'));
      reader.readAsDataURL(file);
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.profileManager = new ProfileManager();
});

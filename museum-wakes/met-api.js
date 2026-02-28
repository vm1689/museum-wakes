// met-api.js — Met Museum Open API (free, no key required)

const MET_API = {
  base: 'https://collectionapi.metmuseum.org/public/collection/v1',

  async getObject(id) {
    try {
      const res = await fetch(`${this.base}/objects/${id}`);
      if (!res.ok) throw new Error('Not found');
      return await res.json();
    } catch (e) {
      return null;
    }
  },

  // Fetch all three gods and cache on STORY.state.godData
  async loadGods() {
    const ids = MET_ARTIFACTS;
    const results = await Promise.allSettled([
      this.getObject(ids.horus),
      this.getObject(ids.isis),
      this.getObject(ids.osiris)
    ]);

    const gods = ['horus', 'isis', 'osiris'];
    gods.forEach((god, i) => {
      if (results[i].status === 'fulfilled' && results[i].value) {
        STORY.state.godData[god] = results[i].value;
      }
    });

    return STORY.state.godData;
  },

  // Extract a clean summary for display
  summarize(obj) {
    if (!obj) return null;
    return {
      title: obj.title || 'Unknown',
      date: obj.objectDate || '',
      culture: obj.culture || 'Ancient Egyptian',
      medium: obj.medium || '',
      image: obj.primaryImageSmall || obj.primaryImage || null,
      department: obj.department || '',
      url: obj.objectURL || ''
    };
  }
};

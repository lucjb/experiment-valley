
// State management
const AppState = {
    state: null,
    listeners: new Set(),

    initialize(initialState) {
        this.state = initialState;
        this.notifyListeners();
    },

    update(newState) {
        this.state = { ...this.state, ...newState };
        this.notifyListeners();
    },

    subscribe(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    },

    notifyListeners() {
        this.listeners.forEach(listener => listener(this.state));
    }
};

export default AppState;

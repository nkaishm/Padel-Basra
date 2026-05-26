// ============================================
// SPIN WHEEL DATE/TIME PICKER - Custom JS
// ============================================

class SpinWheelPicker {
    constructor(options = {}) {
        this.type = options.type || 'datetime'; // 'date', 'time', 'datetime'
        this.minDate = options.minDate || new Date();
        this.maxDate = options.maxDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
        this.onSelect = options.onSelect || (() => {});
        this.onCancel = options.onCancel || (() => {});
        
        this.selectedDate = new Date();
        this.isDragging = false;
        this.startY = 0;
        this.currentY = 0;
        this.columnData = {};
        
        this.months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        this.init();
    }

    init() {
        this.createModal();
        this.bindEvents();
    }

    createModal() {
        // Remove existing modal if any
        const existing = document.getElementById('spinwheel-modal');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.className = 'spinwheel-overlay';
        overlay.id = 'spinwheel-overlay';

        const modal = document.createElement('div');
        modal.className = 'spinwheel-modal';
        modal.id = 'spinwheel-modal';

        let columnsHTML = '';
        
        if (this.type === 'date' || this.type === 'datetime') {
            columnsHTML += `
                <div class="spinwheel-column" data-type="year">
                    <div class="spinwheel-items" id="sw-year"></div>
                    <div class="spinwheel-indicator"></div>
                </div>
                <div class="spinwheel-column" data-type="month">
                    <div class="spinwheel-items" id="sw-month"></div>
                    <div class="spinwheel-indicator"></div>
                </div>
                <div class="spinwheel-column" data-type="day">
                    <div class="spinwheel-items" id="sw-day"></div>
                    <div class="spinwheel-indicator"></div>
                </div>
            `;
        }
        
        if (this.type === 'time' || this.type === 'datetime') {
            columnsHTML += `
                <div class="spinwheel-column" data-type="hour">
                    <div class="spinwheel-items" id="sw-hour"></div>
                    <div class="spinwheel-indicator"></div>
                </div>
                <div class="spinwheel-column" data-type="minute">
                    <div class="spinwheel-items" id="sw-minute"></div>
                    <div class="spinwheel-indicator"></div>
                </div>
            `;
        }

        modal.innerHTML = `
            <div class="spinwheel-header">
                <button class="spinwheel-btn cancel" id="sw-cancel">Cancel</button>
                <span class="spinwheel-title">Select ${this.type === 'date' ? 'Date' : this.type === 'time' ? 'Time' : 'Date & Time'}</span>
                <button class="spinwheel-btn done" id="sw-done">Done</button>
            </div>
            <div class="spinwheel-body">
                ${columnsHTML}
            </div>
        `;

        document.body.appendChild(overlay);
        document.body.appendChild(modal);

        this.overlay = overlay;
        this.modal = modal;
        this.populateColumns();
    }

    populateColumns() {
        const now = new Date();
        const currentYear = now.getFullYear();
        
        // Year
        if (document.getElementById('sw-year')) {
            const years = [];
            for (let y = currentYear; y <= currentYear + 2; y++) {
                years.push(y);
            }
            this.renderColumn('year', years, currentYear);
        }

        // Month
        if (document.getElementById('sw-month')) {
            const currentMonth = now.getMonth();
            this.renderColumn('month', this.months, this.months[currentMonth]);
        }

        // Day
        if (document.getElementById('sw-day')) {
            this.updateDays();
        }

        // Hour
        if (document.getElementById('sw-hour')) {
            const hours = [];
            for (let h = 0; h < 24; h++) {
                hours.push(h.toString().padStart(2, '0'));
            }
            this.renderColumn('hour', hours, '09');
        }

        // Minute
        if (document.getElementById('sw-minute')) {
            const minutes = [];
            for (let m = 0; m < 60; m += 5) {
                minutes.push(m.toString().padStart(2, '0'));
            }
            this.renderColumn('minute', minutes, '00');
        }
    }

    renderColumn(type, items, defaultValue) {
        const container = document.getElementById(`sw-${type}`);
        if (!container) return;

        let html = '';
        items.forEach((item, index) => {
            const isActive = item == defaultValue;
            html += `<div class="spinwheel-item ${isActive ? 'active' : ''}" data-value="${item}" data-index="${index}">${item}</div>`;
        });

        container.innerHTML = html;
        this.columnData[type] = { items, container };
        
        // Scroll to active
        const activeItem = container.querySelector('.active');
        if (activeItem) {
            const itemHeight = 36;
            const offset = activeItem.dataset.index * itemHeight;
            container.style.transform = `translateY(${72 - offset}px)`;
        }
    }

    updateDays() {
        const year = this.getSelectedValue('year') || new Date().getFullYear();
        const month = this.months.indexOf(this.getSelectedValue('month')) || new Date().getMonth();
        
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const days = [];
        for (let d = 1; d <= daysInMonth; d++) {
            days.push(d.toString().padStart(2, '0'));
        }
        
        const currentDay = this.getSelectedValue('day') || '01';
        const safeDay = parseInt(currentDay) > daysInMonth ? daysInMonth.toString().padStart(2, '0') : currentDay;
        
        this.renderColumn('day', days, safeDay);
    }

    getSelectedValue(type) {
        const container = document.getElementById(`sw-${type}`);
        if (!container) return null;
        const active = container.querySelector('.active');
        return active ? active.dataset.value : null;
    }

    bindEvents() {
        // Cancel button
        document.getElementById('sw-cancel').addEventListener('click', () => {
            this.hide();
            this.onCancel();
        });

        // Done button
        document.getElementById('sw-done').addEventListener('click', () => {
            const result = this.getSelectedDate();
            this.hide();
            this.onSelect(result);
        });

        // Overlay click
        this.overlay.addEventListener('click', () => {
            this.hide();
            this.onCancel();
        });

        // Column interactions
        const columns = this.modal.querySelectorAll('.spinwheel-column');
        columns.forEach(column => {
            const items = column.querySelector('.spinwheel-items');
            const type = column.dataset.type;

            // Mouse/Touch events
            column.addEventListener('mousedown', (e) => this.startDrag(e, items, type));
            column.addEventListener('touchstart', (e) => this.startDrag(e, items, type), { passive: true });
            
            document.addEventListener('mousemove', (e) => this.onDrag(e, items));
            document.addEventListener('touchmove', (e) => this.onDrag(e, items), { passive: true });
            
            document.addEventListener('mouseup', () => this.endDrag(items, type));
            document.addEventListener('touchend', () => this.endDrag(items, type));
        });
    }

    startDrag(e, items, type) {
        this.isDragging = true;
        this.dragItems = items;
        this.dragType = type;
        this.startY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;
        
        const transform = items.style.transform;
        this.currentOffset = transform ? parseInt(transform.replace('translateY(', '').replace('px)', '')) || 72 : 72;
        
        items.style.transition = 'none';
    }

    onDrag(e, items) {
        if (!this.isDragging || this.dragItems !== items) return;
        
        const clientY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;
        const delta = clientY - this.startY;
        const newOffset = this.currentOffset + delta;
        
        items.style.transform = `translateY(${newOffset}px)`;
    }

    endDrag(items, type) {
        if (!this.isDragging || this.dragItems !== items) return;
        this.isDragging = false;
        
        items.style.transition = 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)';
        
        const itemHeight = 36;
        const currentTransform = items.style.transform;
        const currentOffset = parseInt(currentTransform.replace('translateY(', '').replace('px)', '')) || 72;
        
        // Calculate nearest item
        const containerHeight = 180;
        const centerOffset = containerHeight / 2 - itemHeight / 2; // 72
        const relativeOffset = centerOffset - currentOffset;
        const nearestIndex = Math.round(relativeOffset / itemHeight);
        
        const maxIndex = items.children.length - 1;
        const clampedIndex = Math.max(0, Math.min(nearestIndex, maxIndex));
        
        const newOffset = centerOffset - (clampedIndex * itemHeight);
        items.style.transform = `translateY(${newOffset}px)`;
        
        // Update active class
        Array.from(items.children).forEach((item, index) => {
            item.classList.toggle('active', index === clampedIndex);
        });

        // Update days if month/year changed
        if (type === 'month' || type === 'year') {
            setTimeout(() => this.updateDays(), 350);
        }
    }

    getSelectedDate() {
        const year = this.getSelectedValue('year');
        const month = this.months.indexOf(this.getSelectedValue('month'));
        const day = this.getSelectedValue('day');
        const hour = this.getSelectedValue('hour') || '00';
        const minute = this.getSelectedValue('minute') || '00';

        if (this.type === 'date') {
            return {
                date: new Date(year, month, day),
                formatted: `${year}-${(month + 1).toString().padStart(2, '0')}-${day}`,
                display: `${this.months[month]} ${day}, ${year}`
            };
        } else if (this.type === 'time') {
            return {
                time: `${hour}:${minute}`,
                formatted: `${hour}:${minute}`,
                display: `${hour}:${minute}`
            };
        } else {
            const date = new Date(year, month, day, hour, minute);
            return {
                date: date,
                formatted: `${year}-${(month + 1).toString().padStart(2, '0')}-${day}T${hour}:${minute}:00`,
                display: `${this.months[month]} ${day}, ${year} ${hour}:${minute}`
            };
        }
    }

    show() {
        this.overlay.classList.add('active');
        this.modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    hide() {
    this.overlay.classList.remove('active');
    this.modal.classList.remove('active');
    document.body.style.overflow = '';
    
    // إزالة العناصر من DOM بعد الانتهاء
    setTimeout(() => {
        if (this.overlay && this.overlay.parentNode) {
            this.overlay.parentNode.removeChild(this.overlay);
        }
        if (this.modal && this.modal.parentNode) {
            this.modal.parentNode.removeChild(this.modal);
        }
    }, 300);
}
}

// ============================================
// HELPER FUNCTION - Easy initialization
// ============================================

function createSpinWheel(inputId, options = {}) {
    const input = document.getElementById(inputId);
    if (!input) {
        console.error(`Input with id "${inputId}" not found`);
        return;
    }

    input.classList.add('spinwheel-input');
    input.readOnly = true;
    input.placeholder = options.placeholder || 'Select...';

    const picker = new SpinWheelPicker({
        ...options,
        onSelect: (result) => {
            input.value = result.display;
            input.dataset.value = result.formatted;
            if (options.onSelect) options.onSelect(result);
        },
        onCancel: () => {
            if (options.onCancel) options.onCancel();
        }
    });

    input.addEventListener('click', () => picker.show());

    return picker;
}

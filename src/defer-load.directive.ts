import { isPlatformBrowser } from '@angular/common';
import { AfterViewInit, Directive, ElementRef, EventEmitter, Inject, Input, NgZone, OnDestroy, Output, PLATFORM_ID } from '@angular/core';
import { fromEvent, Subscription } from 'rxjs';
import { debounceTime } from 'rxjs/operators';

@Directive({
    selector: '[deferLoad]'
})
export class DeferLoadDirective implements AfterViewInit, OnDestroy {

    @Input() public preRender: boolean = true;
    @Output() public deferLoad: EventEmitter<any> = new EventEmitter();

    private _intersectionObserver?: IntersectionObserver;
    private _scrollSubscription?: Subscription;

    constructor (
        private _element: ElementRef,
        private _zone: NgZone,
        @Inject(PLATFORM_ID) private platformId: Object
    ) { }

    public ngAfterViewInit () {
        if (isPlatformBrowser(this.platformId)) {
            if (this.hasCompatibleBrowser()) {
                this.registerIntersectionObserver();
                if (this._intersectionObserver && this._element.nativeElement) {
                    this._intersectionObserver.observe(<Element>(this._element.nativeElement));
                }
            } else {
                this.addScrollListeners();
            }
        } else {
            if (this.preRender === true) {
                this.load();
            }
        }
    }

    public hasCompatibleBrowser (): boolean {
        const hasIntersectionObserver = 'IntersectionObserver' in window;
        const userAgent = window.navigator.userAgent;
        const matches = userAgent.match(/Edge\/(\d*)\./i);

        const isEdge = !!matches && matches.length > 1;
        const isEdgeVersion16OrBetter = isEdge && (!!matches && parseInt(matches[1], 10) > 15);

        return hasIntersectionObserver && (!isEdge || isEdgeVersion16OrBetter);
    }

    public ngOnDestroy () {
        this.removeListeners();
    }

    private registerIntersectionObserver (): void {
        if (!!this._intersectionObserver) {
            return;
        }
        this._intersectionObserver = new IntersectionObserver(entries => {
            this.checkForIntersection(entries);
        }, {});
    }

    private checkForIntersection = (entries: Array<IntersectionObserverEntry>) => {
        entries.forEach((entry: IntersectionObserverEntry) => {
            if (this.checkIfIntersecting(entry)) {
                this.load();
                if (this._intersectionObserver && this._element.nativeElement) {
                    this._intersectionObserver.unobserve(<Element>(this._element.nativeElement));
                }
            }
        });
    }

    private checkIfIntersecting (entry: IntersectionObserverEntry) {
        // For Samsung native browser, IO has been partially implemented where by the
        // callback fires, but entry object is empty. We will check manually.
        if (entry && entry.time) {
            return (<any>entry).isIntersecting && entry.target === this._element.nativeElement;
        }
        return this.isVisible();
    }

    private load (): void {
        this.removeListeners();
        this.deferLoad.emit();
    }

    private addScrollListeners () {
        if (this.isVisible()) {
            this.load();
            return;
        }
        this._zone.runOutsideAngular(() => {
            this._scrollSubscription = fromEvent(window, 'scroll')
                .pipe(debounceTime(50))
                .subscribe(this.onScroll);
        });
    }

    private removeListeners () {
        if (this._scrollSubscription) {
            this._scrollSubscription.unsubscribe();
        }

        if (this._intersectionObserver) {
            this._intersectionObserver.disconnect();
        }
    }

    private onScroll = () => {
        if (this.isVisible()) {
            this._zone.run(() => this.load());
        }
    }

    private isVisible () {
        let scrollPosition = this.getScrollPosition();
        let elementOffset = this._element.nativeElement.offsetTop;
        return elementOffset <= scrollPosition;
    }

    private getScrollPosition () {
        // Getting screen size and scroll position for IE
        return (window.scrollY || window.pageYOffset)
            + (document.documentElement.clientHeight || document.body.clientHeight);
    }
}

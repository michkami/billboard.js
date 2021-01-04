/**
 * Copyright (c) 2017 ~ present NAVER Corp.
 * billboard.js project is licensed under the MIT license
 */
import {select as d3Select} from "d3-selection";
import CLASS from "../../config/classes";
import {isFunction} from "../../module/util";

export default {
	initGauge(): void {
		const $$ = this;
		const {config, $el: {arcs}} = $$;
		const appendText = className => {
			arcs.append("text")
				.attr("class", className)
				.style("text-anchor", "middle")
				.style("pointer-events", "none");
		};

		if ($$.hasType("gauge")) {
			const hasMulti = $$.hasMultiArcGauge();

			arcs.append(hasMulti ? "g" : "path")
				.attr("class", CLASS.chartArcsBackground)
				.style("fill", (!hasMulti && config.gauge_background) || null);

			config.gauge_units && appendText(CLASS.chartArcsGaugeUnit);

			if (config.gauge_label_show) {
				appendText(CLASS.chartArcsGaugeMin);
				appendText(CLASS.chartArcsGaugeMax);
			}
		}
	},

	updateGaugeMax(): void {
		const $$ = this;
		const {config, state} = $$;
		const hasMultiGauge = $$.hasMultiArcGauge();

		// to prevent excluding total data sum during the init(when data.hide option is used), use $$.rendered state value
		const max = hasMultiGauge ?
			$$.getMinMaxData().max[0].value : $$.getTotalDataSum(state.rendered);

		// if gauge_max less than max, make max to max value
		if (max > config.gauge_max) {
			config.gauge_max = max;
		}
	},

	redrawMultiArcGauge(): void {
		const $$ = this;
		const {config, state, $el} = $$;
		const {hiddenTargetIds} = $$.state;

		const arcLabelLines = $el.main.selectAll(`.${CLASS.arcs}`)
			.selectAll(`.${CLASS.arcLabelLine}`)
			.data($$.arcData.bind($$));

		const mainArcLabelLine = arcLabelLines.enter()
			.append("rect")
			.attr("class", d => `${CLASS.arcLabelLine} ${CLASS.target} ${CLASS.target}-${d.data.id}`)
			.merge(arcLabelLines);

		mainArcLabelLine
			.style("fill", d => ($$.levelColor ? $$.levelColor(d.data.values[0].value) : $$.color(d.data)))
			.style("display", config.gauge_label_show ? "" : "none")
			.each(function(d) {
				let lineLength = 0;
				const lineThickness = 2;
				let x = 0;
				let y = 0;
				let transform = "";

				if (hiddenTargetIds.indexOf(d.data.id) < 0) {
					const updated = $$.updateAngle(d);
					const innerLineLength = state.gaugeArcWidth / $$.filterTargetsToShow($$.data.targets).length *
						(updated.index + 1);
					const lineAngle = updated.endAngle - Math.PI / 2;
					const arcInnerRadius = state.radius - innerLineLength;
					const linePositioningAngle = lineAngle - (arcInnerRadius === 0 ? 0 : (1 / arcInnerRadius));

					lineLength = state.radiusExpanded - state.radius + innerLineLength;
					x = Math.cos(linePositioningAngle) * arcInnerRadius;
					y = Math.sin(linePositioningAngle) * arcInnerRadius;
					transform = `rotate(${lineAngle * 180 / Math.PI}, ${x}, ${y})`;
				}

				d3Select(this)
					.attr("x", x)
					.attr("y", y)
					.attr("width", lineLength)
					.attr("height", lineThickness)
					.attr("transform", transform)
					.style("stroke-dasharray", `0, ${lineLength + lineThickness}, 0`);
			});
	},

	textForGaugeMinMax(value: number, isMax?: boolean): number | string {
		const $$ = this;
		const {config} = $$;
		const format = config.gauge_label_extents;

		return isFunction(format) ? format.bind($$.api)(value, isMax) : value;
	},

	getGaugeLabelHeight(): 20 | 0 {
		const {config} = this;

		return this.config.gauge_label_show && !config.gauge_fullCircle ? 20 : 0;
	},

	drawGaugeLabels(withTransform) {
		const $$ = this;
		const {config, state, $el: {arcs}} = $$;
		const isFullCircle = config.gauge_fullCircle;
		const gaugeMinLabelSelection = arcs.select(`.${CLASS.chartArcsGaugeMin}`);
		const gaugeMaxLabelSelection = arcs.select(`.${CLASS.chartArcsGaugeMax}`);

		gaugeMinLabelSelection
			.style("font-size", isFullCircle ? () => (`${Math.round(state.radius / 10)}px`) : null)
			.text(`${$$.textForGaugeMinMax(config.gauge_min, false)}`);

		gaugeMaxLabelSelection
			.style("font-size", isFullCircle ? () => (`${Math.round(state.radius / 10)}px`) : null)
			.text(`${$$.textForGaugeMinMax(config.gauge_max, true)}`);

		withTransform && this.transformGaugeLabels(gaugeMinLabelSelection, gaugeMaxLabelSelection);
	},

	transformGaugeLabels(gaugeMinLabelSelection, gaugeMaxLabelSelection) {
		const $$ = this;
		const {config, state} = $$;
		const isFullCircle = config.gauge_fullCircle;
		const startAngle = $$.getStartAngle();
		const endAngle = isFullCircle ? startAngle + $$.getArcLength() : startAngle * -1;
		const innerRadius = state.innerRadius;

		const sinStartAngle = parseFloat(Math.sin(startAngle).toFixed(2));
		const cosStartAngle = parseFloat(Math.cos(startAngle).toFixed(2)) * -1;
		const sinEndAngle = parseFloat(Math.sin(endAngle).toFixed(2));
		const cosEndAngle = parseFloat(Math.cos(endAngle).toFixed(2)) * -1;

		const minLabelWidth = Math.ceil(gaugeMinLabelSelection.node().getComputedTextLength());
		const minLabelHeight = parseInt(gaugeMinLabelSelection.style("font-size"), 10);

		const maxLabelWidth = Math.ceil(gaugeMaxLabelSelection.node().getComputedTextLength());
		const maxLabelHeight = parseInt(gaugeMaxLabelSelection.style("font-size"), 10);

		const dxMinStart = getGaugeLabelXCoordinate(true);
		const dyMinStart = getGaugeLabelYCoordinate(true);

		const dxMaxStart = getGaugeLabelXCoordinate(false);
		const dyMaxStart = getGaugeLabelYCoordinate(false);

		gaugeMinLabelSelection
			.attr("dx", `${dxMinStart}px`)
			.attr("dy", `${dyMinStart}px`);

		// hide gauge max label if it overlaps the min label
		if (gaugeMinMaxLabelsOverlap()) {
			gaugeMaxLabelSelection.style("display", "none");
		} else {
			gaugeMaxLabelSelection.style("display", null);
			gaugeMaxLabelSelection
				.attr("dx", `${dxMaxStart}px`)
				.attr("dy", `${dyMaxStart}px`);
		}

		/**
		 * @param {boolean} isMinLabel calculates coordinate for gauge min label, else gauge max label
		 * @returns {number} returns x coordinate for gauge min or max label
		 */
		function getGaugeLabelXCoordinate(isMinLabel: boolean): number {
			const sinAngle = isMinLabel ? sinStartAngle : sinEndAngle;
			const textWidth = (isMinLabel ? minLabelWidth : maxLabelWidth);
			const textHalfWidthWithMargin = (textWidth / 2) + 4; /* 4px margin between text and arc*/
			const radius = innerRadius < 0 ?
				innerRadius + textHalfWidthWithMargin :
				innerRadius > 0 ?
					innerRadius - textHalfWidthWithMargin :
					0;
			const innerRadiusWithTextWidth = isFullCircle ? innerRadius - textHalfWidthWithMargin : radius;

			return sinAngle * innerRadiusWithTextWidth;
		}

		/**
		 * @param {boolean} isMinLabel calculates coordinate for gauge min label, else gauge max label
		 * @returns {number} returns y coordinate for gauge min or max label
		 */
		function getGaugeLabelYCoordinate(isMinLabel: boolean): number {
			let angle;

			if (isMinLabel) {
				angle = startAngle;
			} else {
				if (endAngle < 0) {
					angle = 2 * Math.PI + endAngle;
				} else if (endAngle > 0) {
					angle = 2 * Math.PI - endAngle;
				} else {
					angle = endAngle;
				}
			}

			const cosAngle = isMinLabel ? cosStartAngle : cosEndAngle;
			const textHeight = isMinLabel ? minLabelHeight : maxLabelHeight;
			const angleUnderXAxis = angle < -0.5 * Math.PI || angle > 0.5 * Math.PI;
			const angleOverXAxis = (-0.5 * Math.PI < angle && angle <= 0.5 * Math.PI) ||
				(-1.5 * Math.PI < angle && angle >= 1.5 * Math.PI);
			const positionFactor = angleOverXAxis ? 1 : angleUnderXAxis ? 1 / Math.PI : 0;

			return cosAngle * (innerRadius - (textHeight * positionFactor));
		}

		/**
		 * @returns {boolean} returns true if gauge max label overlaps gauge min label
		 */
		function gaugeMinMaxLabelsOverlap(): boolean {
			const diffX = Math.ceil(Math.abs(dxMaxStart - dxMinStart));
			const overlapsX = diffX <= (maxLabelWidth - minLabelWidth);
			const diffY = Math.ceil(Math.abs(dyMaxStart - dyMinStart));
			const overlapsY = diffY <= minLabelHeight;

			return overlapsX && overlapsY;
		}
	}
};

import moment from 'moment';
import 'moment/locale/de';
import { Chalk } from 'chalk';
const chalk = new Chalk({ level: 2 });

interface MealPlan {
	number: number;
	year: number;
	days: [Day];
	version: string;
}

interface Day {
	date: string;
	dishes: [Dish];
}

interface Dish {
	name: string;
	prices: PriceList;
	labels: [string];
}

interface PriceList {
	students: Price;
	staff: Price;
	guests: Price;
}

interface Price {
	base_price: number;
	price_per_unit: number;
	unit: string;
}

interface Entry {
	enum_name: string;
	text: Text;
	abbreviation: string;
}

interface Text {
	DE: string;
	EN: string;
}

export default {
	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);
		const path = url.pathname.split('/').splice(1);
		const location = path.length == 2 ? path[0] : 'mensa-arcisstr';
		const date_input = path.length == 2 ? path?.[1] : path?.[0];

		moment.locale('de');

		let date;
		if (date_input) {
			date = moment().day(date_input);
		} else {
			date = moment();
		}

		const day = date.weekday();
		const week = date.week();
		const year = date.year();

		const menuURL = `https://tum-dev.github.io/eat-api/${location}/${year}/${week}.json`;
		const labelURL = `https://tum-dev.github.io/eat-api/enums/labels.json`;

		const responseHeaders = new Headers({
			'content-type': 'text/plain;charset=UTF-8'
		});

		let dishes: MealPlan;
		let labels: [Entry];

		try {
			dishes = await fetch(menuURL).then(r => r.ok ? r.json() : Promise.reject(r.statusText));
			labels = await fetch(labelURL).then(r => r.ok ? r.json() : Promise.reject(r.statusText));
		} catch (error) {
			return new Response(`Error accessing TUM-Eat API: ${error}\n`, { headers: responseHeaders, status: 500 });
		}

		const labelMap = Object.fromEntries(labels.map(item => [item.enum_name, item.abbreviation]));
		const lineLength = 80;
		
		const menu = dishes.days?.[day];

		const output = menu?.dishes.map(dish => {
			const priceClass = dish.prices.students;
			const hasBasePrice = priceClass.base_price != 0;
			const hasPricePerUnit = priceClass.price_per_unit != 0;

			let price;
			if (hasBasePrice && hasPricePerUnit) {
				price = priceClass.base_price + '€' + ' + ' + priceClass.price_per_unit + '€' + '/' + priceClass.unit;
			} else if (hasBasePrice) {
				price = priceClass.base_price + '€';
			} else {
				price = priceClass.price_per_unit + '€' + '/' + priceClass.unit;
			}

			const labels = dish.labels.map(label => labelMap[label]).reduce((acc, val) => acc + ' ' + val);
			const space = ' '.repeat(Math.max(1, lineLength - (dish.name.length + price.length)));
			
			let name;
			let name_ext;
			if (dish.name.length + price.length + 1 > lineLength) {
				const available_space = lineLength - (price.length + 1)
				name = dish.name.slice(0, available_space);
				name_ext = dish.name.slice(available_space, dish.name.length) + '\n';
			} else {
				name = dish.name;
				name_ext = '';
			}

			return chalk.bold(name) + space + chalk.cyan(price) + '\n' + chalk.bold(name_ext) + labels + '\n';
		});

		const title = `Menü ${location} für ${date.format("dddd, MMMM Do YYYY")}:\n`;
		const hline = '─'.repeat(lineLength - 1) + '┘' + '\n';

		const table = output?.reduce((acc, val) => acc + chalk.dim(hline) + val);
		const errorMsg = 'Kein Menü!\n';
		const response = chalk.blueBright(title) + '\n' + (table || chalk.bold.red(errorMsg));

		return new Response(response, { headers: responseHeaders });
	}
};

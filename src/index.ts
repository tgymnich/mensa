import moment from 'moment';
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
		const location = path?.[0] || 'mensa-arcisstr';

		moment.locale('de');

		let date;
		if (path?.[1]) {
			console.log(path[1])
			date = moment().day(path[1]);
		} else {
			console.log('meh')
			date = moment();
		}

		const day = date.weekday();
		const week = date.week();
		const year = date.year();

		const menuURL = `https://tum-dev.github.io/eat-api/${location}/${year}/${week}.json`;
		const labelURL = `https://tum-dev.github.io/eat-api/enums/labels.json`;

		const menuResponse = fetch(menuURL);
		const labelResponse = fetch(labelURL);

		const dishes: MealPlan = await menuResponse.then((response) => response.json());
		const labels: [Entry] = await labelResponse.then((response) => response.json());

		const dict = Object.fromEntries(labels.map(item => [item.enum_name, item.abbreviation]));
		
		const lineLength = 80;
		
		const menu = dishes.days?.[day];
		const output = menu?.dishes.map(dish => {

			const priceClass = dish.prices.students;
			const hasBasePrice = priceClass.base_price != 0;
			const hasPricePerUnit = priceClass.price_per_unit != 0;

			let price;
			if (hasBasePrice) {
				price = priceClass.base_price + '€';
			} else if (hasBasePrice && hasPricePerUnit) {
				price = priceClass.base_price + '€' + ' + ' + priceClass.price_per_unit + '€' + '/' + priceClass.unit;
			} else {
				price = priceClass.price_per_unit + '€' + '/' + priceClass.unit;
			}

			const labels = dish.labels.map(label => dict[label]).reduce((acc, val) => acc + ' ' + val);
			const space = ' '.repeat(Math.max(1, lineLength - (dish.name.length + price.length)));

			return chalk.bold(dish.name) + space + chalk.cyan(price) + '\n' + labels + '\n';
		});

		const header = `Menu at ${location} for ${date.format("dddd, MMMM Do YYYY")}:\n`;
		const hline = ' '.repeat(lineLength) + '\n';
		
		const msg = chalk.blueBright(header) + '\n' + (output?.reduce((acc, val) => acc + chalk.strikethrough.dim(hline) + val) || chalk.bold.red('No Menu!\n'));

		return new Response(msg, {
			headers: {
				"content-type": "text/plain; charset=UTF-8",
			},
		});
	}
};

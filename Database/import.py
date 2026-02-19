import json
import sqlite3

connection = sqlite3.connect('martracers.db')
cursor = connection.cursor()

cursor.execute('delete from Barcodes')

with open('values.json', errors='ignore') as file:
    data = json.load(file)
    for item in data['products']:
        cursor.execute(
            'INSERT INTO Barcodes (barcode_number, title, category, description, image, price, link) VALUES (?, ?, ?, ?, ?, ?, ?)',
            (
                item['barcode_number'],
                item['title'],
                item['category'],
                item['description'],
                item['images'][0] if item['images'] else None,
                item['stores'][0]['price'] if item['stores'] else None,
                item['stores'][0]['link'] if item['stores'] else None,
            )
        )

connection.commit()
connection.close()
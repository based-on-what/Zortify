import json

# # Cargar el archivo JSON con la codificación adecuada
# with open('results.json', 'r', encoding='utf-8') as file:
#     data = json.load(file)

# # Agregar el atributo "listened" a cada entrada
# for key in data:
#     data[key]['listened'] = False

# # Guardar los cambios en un nuevo archivo JSON (o sobrescribir el existente)
# with open('results.json', 'w', encoding='utf-8') as file:
#     json.dump(data, file, indent=4)

# print("Se ha añadido el atributo 'listened' a cada entrada.")

with open('results.json', 'r', encoding='utf-8') as file:
    data = json.load(file)

# Invertir el orden de las entradas
data_invertido = dict(reversed(list(data.items())))

# Guardar los cambios en un nuevo archivo JSON (o sobrescribir el existente)
with open('results.json', 'w', encoding='utf-8') as file:
    json.dump(data_invertido, file, indent=4)

print("El orden de las entradas se ha invertido.")

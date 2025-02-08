import csv

# Input and output file paths
input_file = "fcfs.csv"
output_file = "FCFS-Processed.txt"

try:
    # Read the contents of X.csv
    with open(input_file, "r") as file:
        reader = csv.reader(file)
        data = [row[0] for row in reader]

    # Process each line and write to output file
    with open(output_file, "w") as file:
        for item in data:
            processed_line = f"[\"{item}\"] = true,\n"
            file.write(processed_line)

    print(f"Processing complete. Output written to '{output_file}'.")

except FileNotFoundError:
    print(f"Error: '{input_file}' not found.")
except Exception as e:
    print(f"An error occurred: {e}")

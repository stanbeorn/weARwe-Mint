import requests
import time

# Define the GraphQL endpoint
GRAPHQL_URL = "https://arweave.net/graphql"

# Function to fetch the transactions
def fetch_transactions(cursor=None, batch_size=100):
    # Build the GraphQL query with the cursor for pagination
    query = {
        "query": """
            query ($after: String) {
                transactions(
                    recipients: ["Q-m1C__tJObZCydD_fTcds6np6gHRDDP05PfkCSSLGI"]
                    tags: [
                        { name: "Action", values: ["User.GoToTown"] }
                    ]
                    first: %d
                    after: $after
                ) {
                    edges {
                        cursor
                        node {
                            owner {
                                address
                            }
                        }
                    }
                }
            }
        """ % batch_size,
        "variables": {
            "after": cursor
        }
    }

    try:
        # Increase the timeout to 30 seconds to avoid query timeouts
        response = requests.post(GRAPHQL_URL, json=query, timeout=30)
        
        # Check for errors in the response
        if response.status_code != 200:
            print(f"Error fetching data: {response.status_code}")
            return None, None
        
        data = response.json()
        
        if 'errors' in data:
            print(f"Error in response: {data['errors']}")
            return None, None

        # Return the list of transactions and the next cursor if available
        transactions = []
        for edge in data['data']['transactions']['edges']:
            transactions.append(edge['node']['owner']['address'])

        # Check if there is another page
        next_cursor = data['data']['transactions']['edges'][-1]['cursor'] if 'edges' in data['data']['transactions'] else None
        return transactions, next_cursor
    
    except requests.exceptions.RequestException as e:
        print(f"Request failed: {e}")
        return None, None
    except Exception as e:
        print(f"Unexpected error: {e}")
        return None, None

# Function to handle the pagination and collect all the addresses
def paginate_transactions():
    all_addresses = []
    cursor = None
    while True:
        # Fetch transactions with pagination
        transactions, cursor = fetch_transactions(cursor, batch_size=100)
        
        if transactions is None:
            break

        # Log the transactions and their owner addresses
        for address in transactions:
            print(f"Fetched address: {address}")

        # Add the transactions to the list
        all_addresses.extend(transactions)
        
        # If there is no next cursor, break the loop
        if cursor is None:
            break

        print("More pages available. Updating the cursor to fetch more.")
        time.sleep(1)  # Optional: Add delay to avoid hitting rate limits

    return all_addresses

# Fetch all transactions and print the result
addresses = paginate_transactions()
print("All fetched addresses:", addresses)
